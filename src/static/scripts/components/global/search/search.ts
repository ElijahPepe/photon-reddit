import { getSubFlairs, searchSubreddits, searchUser } from "../../../api/redditApi.js";
import { pushLinkToHistoryComb, pushLinkToHistorySep } from "../../../historyState/historyStateManager.js";
import { ViewChangeData } from "../../../historyState/viewsStack.js";
import { RedditApiType, SortPostsTimeFrame, SortSearchOrder } from "../../../types/misc.js";
import { isLoggedIn } from "../../../utils/globals.js";
import { escADQ, getLoadingIcon } from "../../../utils/htmlStatics.js";
import { elementWithClassInTree, isElementIn } from "../../../utils/htmlStuff.js";
import { extractPath, extractQuery, hasHTML, isParamRedditTruthy, throttle } from "../../../utils/utils.js";
import Ph_FeedLink from "../../link/feedLink/feedLink.js";
import Ph_DropDown, { DirectionX, DirectionY } from "../../misc/dropDown/dropDown.js";
import { DropDownActionData, DropDownEntryParam } from "../../misc/dropDown/dropDownEntry/dropDownEntry.js";
import Ph_Flair from "../../misc/flair/flair.js";
import Ph_Toast, { Level } from "../../misc/toast/toast.js";
import Ph_Header from "../header/header.js";

/**
 * A search field to search reddit for subreddits, user, and posts; child of Ph_Header
 */
export default class Ph_Search extends HTMLElement {
	searchBar: HTMLInputElement;
	sortBy: Ph_DropDown;
	flairSearch: Ph_DropDown;
	areFlairsLoaded: boolean = false;
	searchOrder = SortSearchOrder.relevance;
	searchTimeFrame = SortPostsTimeFrame.all;
	limitToSubreddit: HTMLInputElement;
	searchDropdown: HTMLDivElement;
	resultsWrapper: HTMLDivElement;
	quickSearchThrottled: () => void;
	searchPrefix: string;	// r/ or user
	subModeBtn: HTMLLabelElement;
	userModeBtn: HTMLLabelElement;
	currentSubreddit: string = null;

	constructor() {
		super();
	}

	connectedCallback() {
		if (hasHTML(this)) return;

		this.classList.add("search");

		this.quickSearchThrottled = throttle(this.quickSearch.bind(this), 750, { leading: false, trailing: true });

		this.subModeBtn = document.createElement("label");
		this.subModeBtn.className = "modeButton transparentButtonAlt";
		this.subModeBtn.setAttribute("for", "quickSearch")
		this.subModeBtn.innerText = "r/";
		this.append(this.subModeBtn);
		this.userModeBtn = document.createElement("label");
		this.userModeBtn.setAttribute("for", "quickSearch")
		this.userModeBtn.className = "modeButton transparentButtonAlt";
		this.userModeBtn.innerText = "u/";
		this.append(this.userModeBtn);
		this.subModeBtn.addEventListener("click", () => {
			this.subModeBtn.classList.toggle("checked");
			this.userModeBtn.classList.remove("checked");
			this.searchPrefix = this.searchPrefix === "/r/" ? "" : "/r/";
			this.quickSearch();
			this.searchBar.focus();
		})
		this.userModeBtn.addEventListener("click", () => {
			this.userModeBtn.classList.toggle("checked");
			this.subModeBtn.classList.remove("checked");
			this.searchPrefix = this.searchPrefix === "/user/" ? "" : "/user/";
			this.quickSearch();
			this.searchBar.focus();
		})

		this.searchBar = document.createElement("input");
		this.searchBar.type = "text";
		this.searchBar.autocomplete = "off";
		this.searchBar.id = "quickSearch";
		this.append(this.searchBar);
		this.searchBar.addEventListener("keypress", e => ["Enter", "NumpadEnter"].includes(e.code) && this.search(e));
		this.searchBar.addEventListener("input", this.onTextEnter.bind(this));
		this.searchBar.addEventListener("focus", this.onFocus.bind(this));

		const searchCollapser = document.createElement("button");
		searchCollapser.className = "searchCollapser transparentButton";
		searchCollapser.innerHTML = `<img src="/img/rightArrow.svg" draggable="false" alt="expand">`;
		searchCollapser.addEventListener("click", () => this.classList.toggle("collapsed"))
		this.append(searchCollapser);

		const toggleDropdownBtn = document.createElement("button")
		toggleDropdownBtn.className = "toggleDropdownButton transparentButton";
		toggleDropdownBtn.innerHTML = `<img src="/img/downArrow.svg" draggable="false" alt="expand">`;
		this.append(toggleDropdownBtn);

		const searchButton = document.createElement("button");
		searchButton.className = "searchButton transparentButton";
		searchButton.innerHTML = `<img src="/img/search.svg" draggable="false" alt="search">`;
		this.append(searchButton);
		searchButton.addEventListener("click", this.search.bind(this));

		this.searchDropdown = document.createElement("div");
		this.searchDropdown.className = "searchDropdown";
		this.append(this.searchDropdown);

		const accessibilitySpacer = document.createElement("div");
		accessibilitySpacer.className = "accessibilitySpacer";
		this.searchDropdown.append(accessibilitySpacer);

		this.resultsWrapper = document.createElement("div");
		this.resultsWrapper.className = "resultsWrapper";
		this.searchDropdown.append(this.resultsWrapper);

		const expandedOptions = document.createElement("div");
		expandedOptions.className = "expandedOptions";
		toggleDropdownBtn.addEventListener("click", this.toggleSearchDropdown.bind(this));
		this.searchDropdown.append(expandedOptions);

		const curSort = new URLSearchParams(extractQuery(history.state?.url || ""));
		let curSortStr: string;
		if (history.state && /search$/i.test(extractPath(history.state.url)))
			curSortStr = `Sort - ${curSort.get("sort") || "relevance"}${curSort.get("t") ? `/${curSort.get("t")}` : ""}`;
		else
			curSortStr = `Sort - relevance/all`;
		this.sortBy = new Ph_DropDown([
			{ label: "Relevance", labelImgUrl: "/img/relevance.svg", value: SortSearchOrder.relevance, nestedEntries: [
				{ label: "Hour", value: SortPostsTimeFrame.hour, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Day", value: SortPostsTimeFrame.day, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Week", value: SortPostsTimeFrame.week, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Month", value: SortPostsTimeFrame.month, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Year", value: SortPostsTimeFrame.year, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "All Time", value: SortPostsTimeFrame.all, onSelectCallback: this.setSortOrder.bind(this) },
			] },
			{ label: "Hot", labelImgUrl: "/img/hot.svg", value: SortSearchOrder.hot, nestedEntries: [
				{ label: "Hour", value: SortPostsTimeFrame.hour, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Day", value: SortPostsTimeFrame.day, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Week", value: SortPostsTimeFrame.week, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Month", value: SortPostsTimeFrame.month, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Year", value: SortPostsTimeFrame.year, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "All Time", value: SortPostsTimeFrame.all, onSelectCallback: this.setSortOrder.bind(this) },
			] },
			{ label: "top", labelImgUrl: "/img/top.svg", value: SortSearchOrder.top, nestedEntries: [
				{ label: "Hour", value: SortPostsTimeFrame.hour, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Day", value: SortPostsTimeFrame.day, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Week", value: SortPostsTimeFrame.week, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Month", value: SortPostsTimeFrame.month, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Year", value: SortPostsTimeFrame.year, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "All Time", value: SortPostsTimeFrame.all, onSelectCallback: this.setSortOrder.bind(this) },
			] },
			{ label: "New", labelImgUrl: "/img/new.svg", value: SortSearchOrder.new, onSelectCallback: this.setSortOrder.bind(this) },
			{ label: "Comments", labelImgUrl: "/img/commentEmpty.svg", value: SortSearchOrder.comments, nestedEntries: [
				{ label: "Hour", value: SortPostsTimeFrame.hour, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Day", value: SortPostsTimeFrame.day, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Week", value: SortPostsTimeFrame.week, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Month", value: SortPostsTimeFrame.month, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "Year", value: SortPostsTimeFrame.year, onSelectCallback: this.setSortOrder.bind(this) },
				{ label: "All Time", value: SortPostsTimeFrame.all, onSelectCallback: this.setSortOrder.bind(this) },
			] },
		], curSortStr, DirectionX.right, DirectionY.bottom, false);
		expandedOptions.append(this.sortBy);

		function makeLabelCheckboxPair(labelText: string, checkboxId: string, defaultChecked: boolean, appendTo: HTMLElement): { checkbox: HTMLInputElement, label: HTMLLabelElement } {
			const wrapper = document.createElement("div");
			wrapper.innerHTML = `<label for="${escADQ(checkboxId)}">${labelText}</label>`;
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = checkboxId;
			checkbox.className = "checkbox";
			checkbox.checked = defaultChecked;
			const checkboxVis = document.createElement("label");
			checkboxVis.setAttribute("for", checkboxId);
			wrapper.append(checkbox);
			wrapper.append(checkboxVis);
			appendTo.append(wrapper);
			return { checkbox: checkbox, label: wrapper.children[0] as HTMLLabelElement };
		}

		this.flairSearch = new Ph_DropDown([], "Search by flair", DirectionX.right, DirectionY.bottom, false);
		expandedOptions.append(this.flairSearch);
		this.flairSearch.toggleButton.addEventListener("click", async  () => {
			if (this.areFlairsLoaded || !this.currentSubreddit)
				return;
			let flairData: any[] = await getSubFlairs(this.currentSubreddit);
			const flairs = flairData
				.map(flair => (<DropDownEntryParam> {
					label: Ph_Flair.fromFlairApi(flair, false),
					value: flair.text,
					onSelectCallback: this.searchByFlair.bind(this),
				}));
			if (flairs.length === 0)
				this.flairSearch.setEntries([{ label: `No flairs for ${this.currentSubreddit}` }]);
			else
				this.flairSearch.setEntries(flairs);
			this.areFlairsLoaded = true;
		});

		const { checkbox: limitToCheckbox, label: limitToLabel } = makeLabelCheckboxPair("Limit to", "limitToSubreddit", true, expandedOptions);
		this.limitToSubreddit = limitToCheckbox;

		if (/\/search\/?$/i.test(extractPath(history.state && history.state.url || location.pathname))) {
			const currParams = new URLSearchParams(location.search || extractQuery(history.state.url));
			this.searchBar.value = currParams.get("q");
			this.searchOrder = SortSearchOrder[currParams.get("sort")];
			this.searchTimeFrame = SortPostsTimeFrame[currParams.get("t")];
			this.limitToSubreddit.checked = isParamRedditTruthy(currParams.get("restrict_sr"), true);
		}

		window.addEventListener("click", e => {
			if (!isElementIn(this, e.target as HTMLElement))
				this.minimize();
		});
		window.addEventListener("ph-view-change", (e: CustomEvent) => {
			const subMatches = (e.detail as ViewChangeData).viewState.state.url.match(/^\/r\/[^/?#]+/i);		// /r/all/top --> /r/all
			this.currentSubreddit = subMatches && subMatches[0] || null;
			this.areFlairsLoaded = false;
			if (this.currentSubreddit) {
				limitToLabel.innerText = `Limit to ${this.currentSubreddit}`;
				this.limitToSubreddit.nextElementSibling.classList.remove("hide");
				this.flairSearch.setEntries([isLoggedIn ? {label: getLoadingIcon()} : {label: "Log in to list flairs"}]);
				this.flairSearch.classList.remove("hide");
			}
			else {
				limitToLabel.innerText = "Search everywhere";
				this.limitToSubreddit.nextElementSibling.classList.add("hide");
				this.flairSearch.classList.add("hide");
			}
		});
	}

	onTextEnter() {
		if (this.searchBar.value) {
			if (/^\/?r\//i.test(this.searchBar.value)) {				// starts with r/ or /r/
				this.searchBar.value = this.searchBar.value.replace(/^\/?r\//i, "");	// remove r/ prefix
				if (!this.subModeBtn.classList.contains("checked"))
					this.subModeBtn.click();
			}
			if (/^\/?(u|user)\//i.test(this.searchBar.value)) {		// starts with u/ or /u/ or user/ or ...
				this.searchBar.value = this.searchBar.value.replace(/^\/?(u|user)\//i, "");	// remove u/ prefix
				if (!this.userModeBtn.classList.contains("checked"))
					this.userModeBtn.click();
			}
			this.quickSearchThrottled();
		}
	}

	onFocus() {
		this.classList.add("expanded");
		if (this.classList.contains("expanded"))
			(elementWithClassInTree(this.parentElement, "header") as Ph_Header)?.minimizeAll([this]);
	}

	minimize() {
		this.classList.remove("expanded");
		this.searchBar.blur();
	}
	
	toggleSearchDropdown() {
		this.classList.toggle("expanded");
		if (this.classList.contains("expanded"))
			(elementWithClassInTree(this.parentElement, "header") as Ph_Header)?.minimizeAll([this]);
	}

	setSortOrder(data: DropDownActionData) {
		this.searchOrder = data.valueChain[0];
		this.searchTimeFrame = data.valueChain.length === 2 ? data.valueChain[1] : null;
		const sortStr = `Sort - ${this.searchOrder}${this.searchTimeFrame ? `/${this.searchTimeFrame}` : ""}`;
		data.setButtonLabel(sortStr);
	}

	async quickSearch() {
		this.resultsWrapper.innerText = "";
		if (!this.searchBar.value || /^\/?(r|u|user)\/$/i.test(this.searchBar.value)) {		// prefix r/ or u/ or user/
			return;
		}

		this.resultsWrapper.classList.add("loading");
		// TODO take NSFW preferences into consideration
		let result: RedditApiType;
		try {
			if (this.searchPrefix === "/r/") {
				result = await searchSubreddits(this.searchBar.value, 10);
			}
			else if (this.searchPrefix === "/user/") {
				result = await searchUser(this.searchBar.value, 10);
			}
			else {
				result = await searchSubreddits(this.searchBar.value, 6);
				if (result["error"])
					throw result;
				const users = await searchUser(this.searchBar.value, 4);
				result.data.children.push(...users.data.children);
			}
			if (result["error"])
				throw result;
		} catch (e) {
			console.error("Error loading quick search");
			console.error(e);
			new Ph_Toast(Level.error, "Error loading quick search");
			throw e;
		}
		this.resultsWrapper.classList.remove("loading");

		this.resultsWrapper.innerText = "";
		for (const entry of result.data.children) {
			try {
				this.resultsWrapper.append(new Ph_FeedLink(entry, true));
			}
			catch (e) {
				console.error("Error making search result entry");
				console.error(e);
				new Ph_Toast(Level.error, "Error making search result entry");
			}
		}
	}

	async search(e) {
		const inNewTab: boolean = e && e.ctrlKey || false;

		if (!this.searchBar.value) {
			new Ph_Toast(Level.warning, "Empty search query", { timeout: 2000 });
			return;
		}

		if (this.searchPrefix) {
			if (inNewTab)
				window.open(this.searchPrefix + this.searchBar.value);
			else
				pushLinkToHistoryComb(this.searchPrefix + this.searchBar.value);
			return;
		}

		let url = "/search";
		const currentSubMatches = history.state.url.match(/\/r\/([^/?#]+)/i);		// /r/pics/top --> /r/pics
		if (currentSubMatches && currentSubMatches[1])
			url = currentSubMatches[1].replace(/\/?$/, "/search");		// /r/pics --> /r/pics/search

		const paramsString = new URLSearchParams([
			["q", this.searchBar.value],
			["type", "link"],
			["restrict_sr", this.limitToSubreddit.checked ? "true" : "false"],
			["sort", this.searchOrder],
			["t", this.searchTimeFrame || ""],
		]).toString();
		if (inNewTab)
			window.open(`${url}?${paramsString}`).focus();
		else {
			pushLinkToHistorySep(
				`${this.currentSubreddit ?? ""}/search`,
				`?${paramsString}`
			);
		}
	}

	searchByFlair(data: DropDownActionData) {
		const flairText = data.valueChain[0] as string;
		this.limitToSubreddit.checked = true;
		this.searchBar.value = `flair:${flairText}`;
		this.searchPrefix = "";
		this.search(null);
	}
}

customElements.define("ph-search", Ph_Search);
