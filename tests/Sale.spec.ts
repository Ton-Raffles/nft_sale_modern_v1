import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Sale } from '../wrappers/Sale';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('Sale', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Sale');
    });

    let blockchain: Blockchain;
    let sale: SandboxContract<Sale>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        sale = blockchain.openContract(Sale.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await sale.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sale.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and sale are ready to use
    });
});
