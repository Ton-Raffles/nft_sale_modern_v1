import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type SaleConfig = {
    createdAt: bigint;
    marketplaceAddress: Address;
    nftAddress: Address;
    nftOwnerAddress: Address;
    fullPrice: bigint;
    feesCell: Cell;
    publicKey: Buffer;
};

export function saleConfigToCell(config: SaleConfig): Cell {
    return beginCell()
        .storeRef(
            beginCell()
                .storeUint(0, 1)
                .storeUint(config.createdAt, 32)
                .storeAddress(config.marketplaceAddress)
                .storeAddress(config.nftAddress)
                .storeAddress(config.nftOwnerAddress)
                .endCell()
        )
        .storeCoins(config.fullPrice)
        .storeRef(config.feesCell)
        .storeUint(0, 1)
        .storeBuffer(config.publicKey)
        .endCell();
}

export class Sale implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Sale(address);
    }

    static createFromConfig(config: SaleConfig, code: Cell, workchain = 0) {
        const data = saleConfigToCell(config);
        const init = { code, data };
        return new Sale(contractAddress(workchain, init), init);
    }

    async sendDeploy(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        opts: {
            query_id: bigint;
            signature: Buffer;
        }
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(5, 32).storeUint(opts.query_id, 64).storeBuffer(opts.signature).endCell(),
        });
    }

    async sendCancel(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        opts: {
            query_id: bigint;
        }
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(3, 32).storeUint(opts.query_id, 64).endCell(),
        });
    }

    async sendCangePrice(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        opts: {
            query_id: bigint;
            newPrice: bigint;
            feesCell: Cell;
        }
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(6, 32)
                .storeUint(opts.query_id, 64)
                .storeCoins(opts.newPrice)
                .storeRef(opts.feesCell)
                .endCell(),
        });
    }

    async getSaleData(provider: ContractProvider): Promise<{
        isComplete: bigint;
        createdAt: bigint;
        marketplaceAddress: Address;
        nftAddress: Address;
        nftOwnerAddress: Address;
        fullPrice: bigint;
        marketplaceFeeAddress: Address;
        marketplaceFee: bigint;
        royaltyAddress: Address;
        royaltyAmount: bigint;
        initialized: boolean;
        publicKey: bigint;
    }> {
        const res = (await provider.get('get_sale_data', [])).stack;
        res.skip(1);
        return {
            isComplete: res.readBigNumber(),
            createdAt: res.readBigNumber(),
            marketplaceAddress: res.readAddress(),
            nftAddress: res.readAddress(),
            nftOwnerAddress: res.readAddress(),
            fullPrice: res.readBigNumber(),
            marketplaceFeeAddress: res.readAddress(),
            marketplaceFee: res.readBigNumber(),
            royaltyAddress: res.readAddress(),
            royaltyAmount: res.readBigNumber(),
            initialized: res.readBoolean(),
            publicKey: res.readBigNumber(),
        };
    }
}
