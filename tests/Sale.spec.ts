import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton-community/sandbox';
import { getSecureRandomBytes, keyPairFromSeed, sign, KeyPair } from 'ton-crypto';
import { Cell, Dictionary, beginCell, toNano } from 'ton-core';
import { Sale, saleConfigToCell } from '../wrappers/Sale';
import '@ton-community/test-utils';
import { NFTCollection } from '../wrappers/NFTCollection';
import { compile } from '@ton-community/blueprint';
import { NFTItem } from '../wrappers/NFTItem';

describe('Sale', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let seed: Buffer;
    let keypair: KeyPair;
    let codeNFTCollection: Cell;
    let codeNFTItem: Cell;

    beforeAll(async () => {
        code = await compile('Sale');
        codeNFTCollection = await compile('NFTCollection');
        codeNFTItem = await compile('NFTItem');
    });

    let collection: SandboxContract<NFTCollection>;
    let sale: SandboxContract<Sale>;
    let wallets: SandboxContract<TreasuryContract>[];
    let deployer: SandboxContract<TreasuryContract>;
    let item: SandboxContract<NFTItem>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        wallets = await blockchain.createWallets(10);
        seed = await getSecureRandomBytes(32);
        keypair = keyPairFromSeed(seed);

        collection = blockchain.openContract(
            NFTCollection.createFromConfig(
                {
                    owner: wallets[1].address,
                    collectionContent: Cell.EMPTY,
                    commonContent: Cell.EMPTY,
                    itemCode: codeNFTItem,
                    royaltyBase: 100n,
                    royaltyFactor: 100n,
                },
                codeNFTCollection
            )
        );
        await collection.sendDeploy(wallets[1].getSender(), toNano('0.05'));

        item = blockchain.openContract((await collection.sendMint(wallets[1].getSender(), toNano('0.05'), 0)).result);

        let r = await item.sendDeploy(wallets[1].getSender(), toNano('0.05'));

        deployer = await blockchain.treasury('deployer');
    });

    it('should buy nft', async () => {
        sale = blockchain.openContract(
            Sale.createFromConfig(
                {
                    createdAt: 0n,
                    marketplaceAddress: wallets[0].address,
                    nftAddress: item.address,
                    nftOwnerAddress: wallets[1].address,
                    fullPrice: toNano('2'),
                    feesCell: beginCell()
                        .storeAddress(wallets[2].address)
                        .storeCoins(toNano('0.1'))
                        .storeAddress(wallets[3].address)
                        .storeCoins(toNano('0.2'))
                        .endCell(),
                    publicKey: keypair.publicKey,
                },
                code
            )
        );

        const deployResult = await sale.sendDeploy(deployer.getSender(), toNano('0.05'), {
            query_id: 0n,
            signature: sign(sale.init!.data.hash(), keypair.secretKey),
        });

        await item.sendTransfer(wallets[1].getSender(), toNano('1'), sale.address);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sale.address,
            deploy: true,
            success: true,
        });

        let res = await wallets[4].send({
            to: sale.address,
            value: toNano('2.2'),
            body: beginCell().storeUint(2, 32).storeUint(toNano('234'), 64).endCell(),
        });

        expect(res.transactions).toHaveTransaction({
            from: item.address,
            to: wallets[4].address,
            op: 0xd53276db,
        });
    });

    it('should not buy nft (royalty_amount + marketplace_fee <= full_price * 49 / 100)', async () => {
        sale = blockchain.openContract(
            Sale.createFromConfig(
                {
                    createdAt: 0n,
                    marketplaceAddress: wallets[0].address,
                    nftAddress: item.address,
                    nftOwnerAddress: wallets[1].address,
                    fullPrice: toNano('2'),
                    feesCell: beginCell()
                        .storeAddress(wallets[2].address)
                        .storeCoins(toNano('1'))
                        .storeAddress(wallets[3].address)
                        .storeCoins(toNano('1'))
                        .endCell(),
                    publicKey: keypair.publicKey,
                },
                code
            )
        );

        const deployResult = await sale.sendDeploy(deployer.getSender(), toNano('0.05'), {
            query_id: 0n,
            signature: sign(sale.init!.data.hash(), keypair.secretKey),
        });

        await item.sendTransfer(wallets[1].getSender(), toNano('1'), sale.address);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sale.address,
            deploy: true,
            success: true,
        });

        let res = await wallets[4].send({
            to: sale.address,
            value: toNano('2.2'),
            body: beginCell().storeUint(2, 32).storeUint(toNano('234'), 64).endCell(),
        });

        expect(res.transactions).toHaveTransaction({
            exitCode: 902,
        });
    });

    it('should not buy nft (full_price = 0)', async () => {
        sale = blockchain.openContract(
            Sale.createFromConfig(
                {
                    createdAt: 0n,
                    marketplaceAddress: wallets[0].address,
                    nftAddress: item.address,
                    nftOwnerAddress: wallets[1].address,
                    fullPrice: toNano('0'),
                    feesCell: beginCell()
                        .storeAddress(wallets[2].address)
                        .storeCoins(toNano('0.2'))
                        .storeAddress(wallets[3].address)
                        .storeCoins(toNano('0.3'))
                        .endCell(),
                    publicKey: keypair.publicKey,
                },
                code
            )
        );

        const deployResult = await sale.sendDeploy(deployer.getSender(), toNano('0.05'), {
            query_id: 0n,
            signature: sign(sale.init!.data.hash(), keypair.secretKey),
        });

        await item.sendTransfer(wallets[1].getSender(), toNano('1'), sale.address);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sale.address,
            deploy: true,
            success: true,
        });

        let res = await wallets[4].send({
            to: sale.address,
            value: toNano('2.2'),
            body: beginCell().storeUint(2, 32).storeUint(toNano('234'), 64).endCell(),
        });

        expect(res.transactions).toHaveTransaction({
            exitCode: 901,
        });
    });

    it('should change the sale price', async () => {
        sale = blockchain.openContract(
            Sale.createFromConfig(
                {
                    createdAt: 0n,
                    marketplaceAddress: wallets[0].address,
                    nftAddress: item.address,
                    nftOwnerAddress: wallets[1].address,
                    fullPrice: toNano('0'),
                    feesCell: beginCell()
                        .storeAddress(wallets[2].address)
                        .storeCoins(toNano('0.2'))
                        .storeAddress(wallets[3].address)
                        .storeCoins(toNano('0.3'))
                        .endCell(),
                    publicKey: keypair.publicKey,
                },
                code
            )
        );

        const deployResult = await sale.sendDeploy(deployer.getSender(), toNano('0.05'), {
            query_id: 0n,
            signature: sign(sale.init!.data.hash(), keypair.secretKey),
        });

        await item.sendTransfer(wallets[1].getSender(), toNano('1'), sale.address);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sale.address,
            deploy: true,
            success: true,
        });

        let res = await wallets[1].send({
            to: sale.address,
            value: toNano('0.05'),
            body: beginCell().storeUint(6, 32).storeUint(toNano('234'), 64).storeCoins(toNano('2')).endCell(),
        });

        let saleData = await sale.getSaleData();

        expect(saleData.fullPrice).toEqual(toNano('2'));
    });
});
