/**
 * Class to hold information about the node attached to an input element.
 * Used to control behavior based on node information.
 */
export class NodeInfo {
    /**
     * @param {string} nodeType - The type/class name of the node
     * @param {string} inputName - The name of the input widget
     */
    constructor(nodeType, inputName) {
        this.nodeType = nodeType;
        this.inputName = inputName;
    }
}
