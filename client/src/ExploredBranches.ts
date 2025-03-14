import { BranchFailurePath } from './ViperProtocol';
import { BranchTree } from './BranchTree';

export class ExploredBranches {
    public tree: BranchTree;
    public cached: boolean;

    constructor(tree: BranchTree, cached: boolean) {
        this.tree = tree;
        this.cached = cached; // per method
    }
}