import Ph_DropDown from "../dropDown/dropDown.js";

export default class Ph_DropDownEntry extends HTMLButtonElement {
	valueChain: any[];
	nextDropDown: Ph_DropDown = null;
	label: HTMLDivElement;

	constructor(param: DropDownEntryParam, dropDown: Ph_DropDown, parentEntry?: Ph_DropDownEntry) {
		super();

		this.classList.add("dropDownEntry");

		if (parentEntry)
			this.valueChain = [...parentEntry.valueChain, param.value];
		else
			this.valueChain = [param.value];

		this.label = document.createElement("div");
		this.label.innerText = param.displayText;
		this.appendChild(this.label);

		if (param.nestedEntries && param.nestedEntries.length > 0) {
			const expandList = document.createElement("div");
			expandList.innerText = ">";
			this.appendChild(expandList);

			this.nextDropDown = new Ph_DropDown(param.nestedEntries, null, this);
			setTimeout(() => dropDown.insertAdjacentElement("afterend", this.nextDropDown), 0);
			this.nextDropDown.classList.add("remove");
		}

		this.addEventListener("click", e => {
			if (param.nestedEntries) {
				this.nextDropDown.showMenu();
				dropDown.closeMenu();
			}
			else if (param.onSelectCallback) {
				param.onSelectCallback(this.valueChain, this);
				dropDown.closeMenu(true);
			}
		});
	}

	setText(text: string) {
		this.label.innerText = text;
	}
}

export interface DropDownEntryParam {
	displayText: string,
	value: any,
	onSelectCallback?: (valueChain: any[], source: Ph_DropDownEntry) => void,
	nestedEntries?: DropDownEntryParam[]
}

customElements.define("ph-drop-down-entry", Ph_DropDownEntry, { extends: "button" });
