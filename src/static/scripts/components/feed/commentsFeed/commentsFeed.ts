import { RedditApiType, SortCommentsOrder } from "../../../types/misc.js";
import { linksToSpa } from "../../../utils/htmlStuff.js";
import { extractQuery, hasParams } from "../../../utils/utils.js";
import Ph_Comment from "../../comment/comment.js";
import Ph_Toast, { Level } from "../../misc/toast/toast.js";
import Ph_Post from "../../post/post.js";

/**
 * A list of Ph_Comment; has sorter; can have special link
 */
export default class Ph_CommentsFeed extends HTMLElement {
	sort: SortCommentsOrder;

	constructor(comments: RedditApiType, post: Ph_Post, suggestedSort: SortCommentsOrder | null) {
		super();
		if (!hasParams(arguments)) return;

		this.classList.add("commentsFeed");

		const urlSort = new URLSearchParams(extractQuery(history.state.url)).get("sort");
		this.sort = urlSort ? SortCommentsOrder[urlSort] : suggestedSort;

		for (const commentData of comments.data.children) {
			try {
				this.appendChild(new Ph_Comment(commentData, false, false, post));
			}
			catch (e) {
				console.error("Error making root comment");
				console.error(e);
				new Ph_Toast(Level.error, "Error making comment");
			}
		}
	}

	insertParentLink(link: string, displayText: string) {
		const linkA = document.createElement("a");
		linkA.href = link;
		linkA.innerText = displayText;
		linkA.className = "parentCommentsLink";
		linksToSpa(linkA);
		this.insertAdjacentElement("afterbegin", linkA);
	}
}

customElements.define("ph-comments-feed", Ph_CommentsFeed);
