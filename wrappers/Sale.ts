import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type SaleConfig = {};

export function saleConfigToCell(config: SaleConfig): Cell {
    return beginCell().endCell();
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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
