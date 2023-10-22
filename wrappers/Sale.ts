import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type SaleConfig = {
    createdAt: bigint;
    marketplaceAddress: Address;
    nftAddress: Address;
    nftOwnerAddress: Address;
    fullPrice: bigint;
    feesCell: Cell;
    publicKey: bigint;
};

export function saleConfigToCell(config: SaleConfig): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeUint(config.createdAt, 32)
        .storeAddress(config.marketplaceAddress)
        .storeAddress(config.nftAddress)
        .storeAddress(config.nftOwnerAddress)
        .storeCoins(config.fullPrice)
        .storeRef(config.feesCell)
        .storeUint(0, 1)
        .storeUint(config.publicKey, 256)
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
}
