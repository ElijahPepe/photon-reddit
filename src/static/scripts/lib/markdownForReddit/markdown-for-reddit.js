// src/parsers/P_Parser.js
var AfterParseResult;
(function(AfterParseResult2) {
  AfterParseResult2[AfterParseResult2["ended"] = 0] = "ended";
  AfterParseResult2[AfterParseResult2["consumed"] = 1] = "consumed";
  AfterParseResult2[AfterParseResult2["text"] = 2] = "text";
})(AfterParseResult || (AfterParseResult = {}));
var ParsingState;
(function(ParsingState2) {
  ParsingState2[ParsingState2["notStarted"] = 0] = "notStarted";
  ParsingState2[ParsingState2["start"] = 1] = "start";
  ParsingState2[ParsingState2["content"] = 2] = "content";
  ParsingState2[ParsingState2["end"] = 3] = "end";
  ParsingState2[ParsingState2["completed"] = 4] = "completed";
})(ParsingState || (ParsingState = {}));
var ParserType = class {
  make(cursor) {
    return new this.constr(cursor, ...this.otherParams);
  }
  static from(constr, ...otherParams) {
    const type = new ParserType();
    type.constr = constr;
    type.otherParams = otherParams;
    return type;
  }
};
var P_Parser = class {
  constructor(cursor) {
    this.joinChars = "";
    this.children = [];
    this.parsingChild = null;
    this.tryTextAlternative = false;
    this.cursor = cursor;
  }
  canStart() {
    for (const state of this.possibleChildren) {
      const newState = state.make(this.cursor);
      if (newState.canStart())
        return true;
    }
    return false;
  }
  parseChar() {
    if (this.parsingChild === null || this.tryTextAlternative) {
      for (const state of this.possibleChildren) {
        const newParser = state.make(this.cursor);
        if (!(this.tryTextAlternative && newParser.id === "text") && newParser.canStart()) {
          this.parsingChild = newParser;
          this.children.push(newParser);
          break;
        }
      }
      if (this.parsingChild === null)
        throw new Error("Couldn't start parsing");
      this.tryTextAlternative = false;
    }
    const parseResult = this.parsingChild.parseChar();
    if (parseResult === AfterParseResult.ended) {
      this.parsingChild = null;
      if (this.canChildrenRepeat && this.canStart()) {
        return AfterParseResult.consumed;
      } else {
        return AfterParseResult.ended;
      }
    } else if (parseResult === AfterParseResult.consumed) {
      return AfterParseResult.consumed;
    } else if (parseResult === AfterParseResult.text) {
      this.tryTextAlternative = true;
      return AfterParseResult.consumed;
    } else {
      throw new Error("wut?");
    }
  }
  canConsumeChar() {
    return this.parsingChild ? this.parsingChild.canConsumeChar() : false;
  }
  toHtmlString() {
    return this.children.map((ch) => ch.toHtmlString()).join(this.joinChars);
  }
};

// src/utils.js
function escapeHtml(string) {
  const str = "" + string;
  const match = /["'<>]|&(?!([a-zA-Z\d]+|#\d+|#x[a-fA-F\d]+);)/.exec(str);
  if (!match) {
    return str;
  }
  let escape;
  let html = "";
  let index;
  let lastIndex = 0;
  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
    case 34:
      escape = "&quot;";
      break;
    case 38:
      escape = "&amp;";
      break;
    case 39:
      escape = "&#39;";
      break;
    case 60:
      escape = "&lt;";
      break;
    case 62:
      escape = "&gt;";
      break;
    default:
      continue;
    }
    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }
    lastIndex = index + 1;
    html += escape;
  }
  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}
function escapeRegex(strToEscape) {
  return strToEscape.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/parsers/P_StyledText.js
var P_StyledText = class extends P_Parser {
  constructor(cursor, options = {}) {
    super(cursor);
    this.id = "styledText";
    this.canChildrenRepeat = true;
    this.possibleChildren = [];
    this.parsingState = ParsingState.notStarted;
    this.styleType = null;
    this.parsedStartChars = "";
    this.parsedEndChars = "";
    this.excludedCharSeq = options.excludedCharSeq || [];
    this.allowLinks = options.allowLinks;
  }
  canStart() {
    for (const styleType of P_StyledText.styleTypes) {
      if (!this.excludedCharSeq.includes(styleType.charSequence) && new RegExp("^" + escapeRegex(styleType.charSequence) + ".*" + escapeRegex(styleType.charSequenceEnd || styleType.charSequence), "s").test(this.cursor.remainingText) && /^(?!\s)/.test(this.cursor.remainingText.slice(styleType.charSequence.length)) && this.cursor.previousChar !== "\\") {
        return true;
      }
    }
    return false;
  }
  parseChar() {
    if (this.parsingState === ParsingState.notStarted) {
      for (const styleType of P_StyledText.styleTypes) {
        if (!this.excludedCharSeq.includes(styleType.charSequence) && new RegExp("^" + escapeRegex(styleType.charSequence) + ".*" + escapeRegex(styleType.charSequenceEnd || styleType.charSequence), "s").test(this.cursor.remainingText)) {
          this.styleType = styleType;
          break;
        }
      }
      this.possibleChildren[0] = ParserType.from(P_BasicText, {
        excludedStyleTypes: this.excludedCharSeq.concat(this.styleType.charSequence),
        allowLinks: this.allowLinks
      });
      this.parsingState = ParsingState.start;
    }
    if (this.parsingState === ParsingState.start) {
      this.parsedStartChars += this.cursor.currentChar;
      if (this.parsedStartChars === this.styleType.charSequence)
        this.parsingState = ParsingState.content;
      return AfterParseResult.consumed;
    }
    if (this.parsingState === ParsingState.content) {
      const afterEscapeText = this.cursor.remainingText.slice(this.getCharSequenceEnd().length);
      if (this.cursor.remainingText.startsWith(this.getCharSequenceEnd()) && !(this.styleType.noMidWordEnd && /^\S/.test(afterEscapeText)) && this.parsingChild && !this.parsingChild.canConsumeChar()) {
        this.parsingState = ParsingState.end;
      } else {
        this.cursor.isNewNode = true;
        return super.parseChar();
      }
    }
    if (this.parsingState === ParsingState.end) {
      this.parsedEndChars += this.cursor.currentChar;
      if (this.parsedEndChars === this.getCharSequenceEnd()) {
        this.parsingState = ParsingState.completed;
        return AfterParseResult.ended;
      }
      return AfterParseResult.consumed;
    }
  }
  canConsumeChar() {
    const remainingEndChars = this.getCharSequenceEnd().slice(this.parsedEndChars.length);
    return this.cursor.remainingText.startsWith(remainingEndChars) || super.canConsumeChar();
  }
  toHtmlString() {
    if (this.parsingState === ParsingState.completed)
      return `<${this.styleType.tagName}${this.styleType.tagOther ?? ""}>${super.toHtmlString()}</${this.styleType.tagName}>`;
    else
      return `${escapeHtml(this.parsedStartChars)}${super.toHtmlString()}${escapeHtml(this.parsedEndChars)}`;
  }
  getCharSequenceEnd() {
    return this.styleType.charSequenceEnd ?? this.styleType.charSequence;
  }
};
P_StyledText.styleTypes = [
  { charSequence: "**", tagName: "strong" },
  { charSequence: "__", tagName: "strong" },
  { charSequence: "*", tagName: "em" },
  { charSequence: "_", tagName: "em", noMidWordEnd: true },
  { charSequence: "~~", tagName: "del" },
  { charSequence: ">!", charSequenceEnd: "!<", tagName: "span", tagOther: ` class="md-spoiler-text"` }
];

// src/parsers/P_Text.js
var P_Text = class extends P_Parser {
  constructor(cursor, modifyLineBreaks = true, preserveTabs = false) {
    super(cursor);
    this.id = "text";
    this.canChildrenRepeat = false;
    this.possibleChildren = [];
    this.parsedText = "";
    this.modifyLineBreaks = modifyLineBreaks;
    this.preserveTabs = preserveTabs;
  }
  canStart() {
    return true;
  }
  parseChar() {
    this.parsedText += this.cursor.currentChar;
    return AfterParseResult.text;
  }
  toHtmlString() {
    let text = this.parsedText;
    if (this.preserveTabs) {
      text = text.replace(/\t/g, "    ");
    } else {
      text = text.replace(/\t/g, " ");
    }
    if (this.modifyLineBreaks) {
      text = text.replace(P_Text.escapableCharsRegex, "$1");
      text = escapeHtml(text);
      text = text.replace(/ {2,}\n/g, "<br/>\n");
      text = text.replace(/(?<!<br\/>)\s*\n(?=.+)/g, " ");
    } else
      text = escapeHtml(text);
    return text;
  }
};
P_Text.escapableCharsRegex = /\\([`~*_\-\\><\]\[^\/#|)])/g;

// src/parsers/P_InlineCode.js
var InlineCodeParsingState;
(function(InlineCodeParsingState2) {
  InlineCodeParsingState2[InlineCodeParsingState2["tickStart"] = 0] = "tickStart";
  InlineCodeParsingState2[InlineCodeParsingState2["wsStart"] = 1] = "wsStart";
  InlineCodeParsingState2[InlineCodeParsingState2["content"] = 2] = "content";
  InlineCodeParsingState2[InlineCodeParsingState2["wsEnd"] = 3] = "wsEnd";
  InlineCodeParsingState2[InlineCodeParsingState2["tickEnd"] = 4] = "tickEnd";
  InlineCodeParsingState2[InlineCodeParsingState2["completed"] = 5] = "completed";
  InlineCodeParsingState2[InlineCodeParsingState2["error"] = 6] = "error";
})(InlineCodeParsingState || (InlineCodeParsingState = {}));
var P_InlineCode = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "InlineCode";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_Text, false)];
    this.parsedStartChars = "";
    this.parsedEndChars = "";
    this.backtickCount = 0;
    this.backtickCountEnd = 0;
    this.parsingState = InlineCodeParsingState.tickStart;
  }
  canStart() {
    return /^(`+).*\1/.test(this.cursor.remainingText) && this.cursor.previousChar !== "\\";
  }
  parseChar() {
    if (this.parsingState === InlineCodeParsingState.tickStart) {
      if (this.cursor.currentChar === "`") {
        this.backtickCount++;
        this.parsedStartChars += this.cursor.currentChar;
        return AfterParseResult.consumed;
      }
      if (/\s/.test(this.cursor.currentChar)) {
        this.parsedStartChars += this.cursor.currentChar;
        this.parsingState = InlineCodeParsingState.wsStart;
        return AfterParseResult.consumed;
      } else {
        this.parsingState = InlineCodeParsingState.content;
      }
    }
    if (this.parsingState === InlineCodeParsingState.wsStart) {
      if (/\s/.test(this.cursor.currentChar)) {
        this.parsedStartChars += this.cursor.currentChar;
        return AfterParseResult.consumed;
      } else {
        this.parsingState = InlineCodeParsingState.content;
      }
    }
    if (this.parsingState === InlineCodeParsingState.content) {
      if (new RegExp("^\\s*" + "`".repeat(this.backtickCount)).test(this.cursor.remainingText)) {
        if (/\s/.test(this.cursor.currentChar)) {
          this.parsingState = InlineCodeParsingState.wsEnd;
          return AfterParseResult.consumed;
        } else {
          this.parsingState = InlineCodeParsingState.tickEnd;
        }
      } else {
        super.parseChar();
        return AfterParseResult.consumed;
      }
    }
    if (this.parsingState === InlineCodeParsingState.wsEnd) {
      if (/\s/.test(this.cursor.currentChar)) {
        this.parsedEndChars += this.cursor.currentChar;
        return AfterParseResult.consumed;
      } else {
        this.parsingState = InlineCodeParsingState.tickEnd;
      }
    }
    if (this.parsingState === InlineCodeParsingState.tickEnd) {
      if (this.cursor.currentChar === "`") {
        this.parsedEndChars += this.cursor.currentChar;
        this.backtickCountEnd++;
        if (this.backtickCount === this.backtickCountEnd) {
          this.parsingState = InlineCodeParsingState.completed;
          return AfterParseResult.ended;
        } else {
          return AfterParseResult.consumed;
        }
      }
    }
    return super.parseChar();
  }
  canConsumeChar() {
    return !/^\s+$/.test(this.cursor.currentLine);
  }
  toHtmlString() {
    if (this.parsingState === InlineCodeParsingState.completed)
      return `<code>${super.toHtmlString()}</code>`;
    else
      return this.parsedStartChars + super.toHtmlString() + this.parsedEndChars;
  }
};

// src/parsers/P_Superscript.js
var P_Superscript = class extends P_Parser {
  constructor(cursor, options = {}) {
    super(cursor);
    this.id = "superscript";
    this.canChildrenRepeat = true;
    this.possibleChildren = [ParserType.from(P_BasicText)];
    this.parsedStartChars = "";
    this.parseState = ParsingState.notStarted;
    if (options.allowLinks)
      this.possibleChildren[0].allowLinks = true;
  }
  canStart() {
    return /^\^(\S+|(\(.*\)))/s.test(this.cursor.remainingText) && this.cursor.previousChar !== "\\";
  }
  parseChar() {
    if (this.parseState === ParsingState.notStarted) {
      this.usesParentheses = this.cursor.remainingText[1] === "(";
      if (this.usesParentheses)
        this.parseState = ParsingState.start;
      else
        this.parseState = ParsingState.content;
      this.parsedStartChars += this.cursor.currentChar;
      return AfterParseResult.consumed;
    }
    if (this.parseState === ParsingState.start) {
      this.parsedStartChars += this.cursor.currentChar;
      this.parseState = ParsingState.content;
      return AfterParseResult.consumed;
    }
    if (this.parseState === ParsingState.content) {
      if (this.usesParentheses && this.cursor.currentChar === ")") {
        this.parseState = ParsingState.completed;
        return AfterParseResult.ended;
      }
      if (!this.usesParentheses && /\s/.test(this.cursor.remainingText[1] ?? " ")) {
        this.parseState = ParsingState.completed;
        super.parseChar();
        return AfterParseResult.ended;
      }
      return super.parseChar();
    }
  }
  toHtmlString() {
    if (this.parseState === ParsingState.completed || !this.usesParentheses)
      return `<sup>${super.toHtmlString()}</sup>`;
    else
      return `^${this.usesParentheses ? "(" : ""}${super.toHtmlString()}`;
  }
};

// src/parsers/P_Link.js
var LinkParsingState;
(function(LinkParsingState2) {
  LinkParsingState2[LinkParsingState2["notStarted"] = 0] = "notStarted";
  LinkParsingState2[LinkParsingState2["reddit"] = 1] = "reddit";
  LinkParsingState2[LinkParsingState2["schema"] = 2] = "schema";
  LinkParsingState2[LinkParsingState2["manual"] = 3] = "manual";
})(LinkParsingState || (LinkParsingState = {}));
var ManualLinkParsingState;
(function(ManualLinkParsingState2) {
  ManualLinkParsingState2[ManualLinkParsingState2["start"] = 0] = "start";
  ManualLinkParsingState2[ManualLinkParsingState2["content"] = 1] = "content";
  ManualLinkParsingState2[ManualLinkParsingState2["separation"] = 2] = "separation";
  ManualLinkParsingState2[ManualLinkParsingState2["link"] = 3] = "link";
  ManualLinkParsingState2[ManualLinkParsingState2["title"] = 4] = "title";
  ManualLinkParsingState2[ManualLinkParsingState2["end"] = 5] = "end";
})(ManualLinkParsingState || (ManualLinkParsingState = {}));
var redditRegex = /^\/?(r|u|user)\/[^\/]+/;
var schemaRegex = /^(http:\/\/|https:\/\/|ftp:\/\/|mailto:|git:\/\/|steam:\/\/|irc:\/\/|news:\/\/|mumble:\/\/|ssh:\/\/|ircs:\/\/|ts3server:\/\/).+/;
var manualRegex = /^\[.+]\((http:\/\/|https:\/\/|ftp:\/\/|mailto:|git:\/\/|steam:\/\/|irc:\/\/|news:\/\/|mumble:\/\/|ssh:\/\/|ircs:\/\/|ts3server:\/\/|\/|#)([^)]|\\\)|\\\()+\)/s;
var P_Link = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "link";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_BasicText)];
    this.parsingState = LinkParsingState.notStarted;
    this.manualLinkParsingState = ManualLinkParsingState.start;
    this.titleSurrounding = "";
    this.url = "";
    this.altLinkText = "";
    this.title = "";
  }
  canStart() {
    return (redditRegex.test(this.cursor.remainingText) && this.cursor.previousChar !== "\\" || schemaRegex.test(this.cursor.remainingText) || manualRegex.test(this.cursor.remainingText)) && (/^(|\W)$/.test(this.cursor.previousChar) || this.cursor.isNewNode);
  }
  parseChar() {
    if (this.parsingState === LinkParsingState.notStarted) {
      if (redditRegex.test(this.cursor.remainingText))
        this.parsingState = LinkParsingState.reddit;
      else if (schemaRegex.test(this.cursor.remainingText))
        this.parsingState = LinkParsingState.schema;
      else if (manualRegex.test(this.cursor.remainingText))
        this.parsingState = LinkParsingState.manual;
    }
    if (this.parsingState === LinkParsingState.reddit) {
      if (this.url === "" && this.cursor.currentChar !== "/")
        this.url += "/";
      if (/[\/a-zA-Z0-9\-_+]/.test(this.cursor.currentChar) || this.cursor.remainingText.startsWith(".com") && /(r\/|\+)reddit$/.test(this.cursor.previousText)) {
        this.url += this.cursor.currentChar;
        this.altLinkText += this.cursor.currentChar;
        if (!/[\/a-zA-Z0-9\-_+]/.test(this.cursor.remainingText[1]) && !(this.cursor.remainingText.startsWith("t.com") && /(r\/|\+)reddi$/.test(this.cursor.previousText)))
          return AfterParseResult.ended;
        else
          return AfterParseResult.consumed;
      }
      return AfterParseResult.ended;
    }
    if (this.parsingState === LinkParsingState.schema) {
      this.url += this.cursor.currentChar;
      this.altLinkText += this.cursor.currentChar;
      if (/[\s|)]/.test(this.cursor.remainingText[1]))
        return AfterParseResult.ended;
      else
        return AfterParseResult.consumed;
    }
    if (this.parsingState === LinkParsingState.manual) {
      if (this.manualLinkParsingState === ManualLinkParsingState.start) {
        this.manualLinkParsingState = ManualLinkParsingState.content;
      } else if (this.manualLinkParsingState === ManualLinkParsingState.content) {
        if (this.cursor.currentChar === "]" && this.cursor.previousChar !== "\\")
          this.manualLinkParsingState = ManualLinkParsingState.separation;
        else
          super.parseChar();
      } else if (this.manualLinkParsingState === ManualLinkParsingState.separation) {
        this.manualLinkParsingState = ManualLinkParsingState.link;
      } else if (this.manualLinkParsingState === ManualLinkParsingState.link) {
        if (this.cursor.currentChar === ")" && this.cursor.previousChar !== "\\")
          return AfterParseResult.ended;
        else if (this.cursor.currentChar === " ") {
          this.manualLinkParsingState = ManualLinkParsingState.title;
        } else
          this.url += this.cursor.currentChar;
      } else if (this.manualLinkParsingState === ManualLinkParsingState.title) {
        if (this.title === "" && /["']/.test(this.cursor.currentChar)) {
          this.titleSurrounding = this.cursor.currentChar;
          return AfterParseResult.consumed;
        } else if (this.titleSurrounding && this.cursor.currentChar === this.titleSurrounding) {
          this.manualLinkParsingState = ManualLinkParsingState.end;
        } else if (/[)\n]/.test(this.cursor.currentChar))
          return AfterParseResult.ended;
        else
          this.title += this.cursor.currentChar;
      } else if (this.manualLinkParsingState === ManualLinkParsingState.end) {
        return AfterParseResult.ended;
      }
      return AfterParseResult.consumed;
    }
  }
  toHtmlString() {
    return `<a href="${escapeHtml(encodeURI(this.url))}"${this.title ? ` title="${this.title}"` : ""}>${super.toHtmlString() || escapeHtml(this.altLinkText)}</a>`;
  }
};

// src/parsers/P_BasicText.js
var P_BasicText = class extends P_Parser {
  constructor(cursor, options = {}) {
    super(cursor);
    this.id = "basicText";
    this.canChildrenRepeat = true;
    this.possibleChildren = [
      ParserType.from(P_StyledText),
      ParserType.from(P_Superscript),
      ParserType.from(P_InlineCode),
      ParserType.from(P_Text)
    ];
    this.possibleChildren[0] = ParserType.from(P_StyledText, { excludedCharSeq: options.excludedStyleTypes || [] });
    if (options.allowLinks) {
      this.possibleChildren.splice(0, 0, ParserType.from(P_Link));
      if (!this.possibleChildren[1].otherParams[0])
        this.possibleChildren[1].otherParams[0] = {};
      if (!this.possibleChildren[2].otherParams[0])
        this.possibleChildren[2].otherParams[0] = {};
      this.possibleChildren[1].otherParams[0].allowLinks = true;
      this.possibleChildren[2].otherParams[0].allowLinks = true;
    }
  }
};

// src/parsers/P_Paragraph.js
var P_Paragraph = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "paragraph";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_BasicText, { allowLinks: true })];
  }
  parseChar() {
    if (this.cursor.column + 1 === this.cursor.currentLine.length && (this.cursor.nextLine === null || /^\s*\n$/.test(this.cursor.nextLine))) {
      return AfterParseResult.ended;
    } else {
      return super.parseChar();
    }
  }
  toHtmlString() {
    return `<p>${super.toHtmlString().replace(/^\s*|\s*(?<!\S )$/g, "")}</p>`;
  }
};

// src/parsers/P_CodeMultilineSpaces.js
var P_CodeMultilineSpaces = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "CodeMultilineSpaces";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_Text, false, true)];
    this.parsingState = ParsingState.start;
    this.parsedStartSpaces = 0;
  }
  canStart() {
    return this.cursor.column === 0 && /^( {4}|\t)/.test(this.cursor.currentLine);
  }
  canConsumeChar() {
    return true;
  }
  parseChar() {
    if (this.parsingState === ParsingState.content) {
      if (this.cursor.column === 0) {
        this.parsedStartSpaces = 0;
        this.parsingState = ParsingState.start;
      } else {
        if (this.cursor.currentChar === "\n") {
          if (!/^( {4}|\t)/.test(this.cursor.nextLine))
            return AfterParseResult.ended;
          super.parseChar();
        } else
          super.parseChar();
        return AfterParseResult.consumed;
      }
    }
    if (this.parsingState === ParsingState.start) {
      this.parsedStartSpaces++;
      if (this.parsedStartSpaces === 4 || this.cursor.currentChar === "	")
        this.parsingState = ParsingState.content;
      return AfterParseResult.consumed;
    }
  }
  toHtmlString() {
    return `<pre><code>${super.toHtmlString()}
</code></pre>`;
  }
};

// src/parsers/P_CodeMultilineFenced.js
var P_CodeMultilineFenced = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "CodeMultilineSpaces";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_Text, false, true)];
    this.parsingState = ParsingState.start;
    this.parsedStartTicks = 0;
  }
  canStart() {
    return this.cursor.column === 0 && /^(`{3,})\n(.*\n)*\1($|\n)/.test(this.cursor.remainingText);
  }
  canConsumeChar() {
    return true;
  }
  parseChar() {
    if (this.parsingState === ParsingState.start) {
      if (this.cursor.currentChar === "\n")
        this.parsingState = ParsingState.content;
      else
        this.parsedStartTicks++;
      return AfterParseResult.consumed;
    }
    if (this.parsingState === ParsingState.content) {
      if (this.cursor.currentChar === "\n" && this.cursor.nextLine === "`".repeat(this.parsedStartTicks) + "\n") {
        this.parsingState = ParsingState.end;
        return AfterParseResult.consumed;
      }
      super.parseChar();
      return AfterParseResult.consumed;
    }
    if (this.parsingState === ParsingState.end) {
      if (this.cursor.currentChar === "\n" || this.cursor.isLastChar) {
        this.parsingState = ParsingState.completed;
        return AfterParseResult.ended;
      }
      return AfterParseResult.consumed;
    }
  }
  toHtmlString() {
    if (this.parsingState === ParsingState.completed)
      return `<pre><code>${super.toHtmlString()}
</code></pre>`;
    else
      return `${"`".repeat(this.parsedStartTicks)}${super.toHtmlString()}`;
  }
};

// src/parsers/P_HorizontalLine.js
var P_HorizontalLine = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "HorizontalLine";
    this.canChildrenRepeat = false;
    this.possibleChildren = [];
  }
  canStart() {
    return /^(-{3,}|\*{3,}|_{3,})(\n|$)/.test(this.cursor.currentLine);
  }
  parseChar() {
    return ["-", "*", "_"].includes(this.cursor.currentChar) ? AfterParseResult.consumed : AfterParseResult.ended;
  }
  toHtmlString() {
    return `<hr/>`;
  }
};

// src/parsers/P_Quote.js
var P_Quote = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "Quote";
    this.canChildrenRepeat = true;
    this.possibleChildren = [ParserType.from(P_Block)];
    this.joinChars = "\n\n";
    this.parsingState = ParsingState.start;
  }
  canStart() {
    return this.cursor.currentLine.startsWith("> ");
  }
  parseChar() {
    if (this.parsingState === ParsingState.start) {
      if (this.cursor.currentChar === " ") {
        this.parsingState = ParsingState.content;
        this.cursor.currentLine = this.cursor.currentLine.slice(2);
        this.cursor.column -= 2;
      }
      return AfterParseResult.consumed;
    }
    if (this.parsingState === ParsingState.content) {
      if (this.cursor.currentChar === "\n") {
        if (this.cursor.nextLine.startsWith("> ")) {
          this.cursor.nextLine = this.cursor.nextLine.slice(2);
          super.parseChar();
          this.parsingState = ParsingState.start;
          return AfterParseResult.consumed;
        }
        this.parsingState = ParsingState.completed;
        return AfterParseResult.ended;
      } else if (this.cursor.isLastChar) {
        super.parseChar();
        return AfterParseResult.ended;
      }
      super.parseChar();
      return AfterParseResult.consumed;
    }
  }
  toHtmlString() {
    return `<blockquote>
${super.toHtmlString()}
</blockquote>`;
  }
};

// src/parsers/P_Heading.js
var P_Heading = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "Heading";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_BasicText, { allowLinks: true })];
    this.headingLevel = 0;
    this.parsingState = ParsingState.start;
  }
  canStart() {
    return /^#{1,6}.*(\n|$)/.test(this.cursor.currentLine);
  }
  parseChar() {
    if (this.parsingState === ParsingState.start) {
      if (this.cursor.currentChar === "#") {
        this.headingLevel++;
        return AfterParseResult.consumed;
      }
      if (this.cursor.currentChar === " ") {
        this.parsingState = ParsingState.content;
        this.headingLevel = Math.min(6, this.headingLevel);
        return AfterParseResult.consumed;
      }
      this.headingLevel = Math.min(6, this.headingLevel);
      this.parsingState = ParsingState.content;
    }
    if (this.parsingState === ParsingState.content) {
      if (this.cursor.currentChar === "\n")
        return AfterParseResult.ended;
      if (this.cursor.isLastChar) {
        super.parseChar();
        return AfterParseResult.ended;
      }
      super.parseChar();
      return AfterParseResult.consumed;
    }
  }
  toHtmlString() {
    return `<h${this.headingLevel}>${super.toHtmlString()}</h${this.headingLevel}>`;
  }
};

// src/parsers/P_Table.js
var TableParsingState;
(function(TableParsingState2) {
  TableParsingState2[TableParsingState2["header"] = 0] = "header";
  TableParsingState2[TableParsingState2["divider"] = 1] = "divider";
  TableParsingState2[TableParsingState2["rows"] = 2] = "rows";
})(TableParsingState || (TableParsingState = {}));
var DataRowParsingState;
(function(DataRowParsingState2) {
  DataRowParsingState2[DataRowParsingState2["pipe"] = 0] = "pipe";
  DataRowParsingState2[DataRowParsingState2["leadingWs"] = 1] = "leadingWs";
  DataRowParsingState2[DataRowParsingState2["content"] = 2] = "content";
  DataRowParsingState2[DataRowParsingState2["end"] = 3] = "end";
  DataRowParsingState2[DataRowParsingState2["completed"] = 4] = "completed";
})(DataRowParsingState || (DataRowParsingState = {}));
var DividerParsingState;
(function(DividerParsingState2) {
  DividerParsingState2[DividerParsingState2["pipe"] = 0] = "pipe";
  DividerParsingState2[DividerParsingState2["firstChar"] = 1] = "firstChar";
  DividerParsingState2[DividerParsingState2["spacer"] = 2] = "spacer";
  DividerParsingState2[DividerParsingState2["lastChar"] = 3] = "lastChar";
  DividerParsingState2[DividerParsingState2["completed"] = 4] = "completed";
})(DividerParsingState || (DividerParsingState = {}));
var P_Table = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "table";
    this.canChildrenRepeat = false;
    this.possibleChildren = [ParserType.from(P_BasicText, { allowLinks: true })];
    this.parsingState = TableParsingState.header;
    this.dataRowParsingState = DataRowParsingState.pipe;
    this.dividerParsingState = DividerParsingState.pipe;
    this.columns = 0;
    this.currentColumn = 0;
    this.currentRow = 0;
    this.columnAlignment = [];
    this.headerValues = [];
    this.cellValues = [];
  }
  canStart() {
    const headerPipes = P_Table.countRowPipes(this.cursor.currentLine);
    const dividerPipes = P_Table.countRowPipes(this.cursor.nextLine);
    return headerPipes >= 2 && dividerPipes >= 2 && (/^\|(.*?(?<!\\)\|+) *\n/.test(this.cursor.currentLine) && /^\|([:\- ]*(?<!\\)\|+)+ *(\n|$)/.test(this.cursor.nextLine));
  }
  parseChar() {
    if (this.parsingState === TableParsingState.header) {
      return this.parseDataRow(() => this.headerValues.push(new P_BasicText(this.cursor)), () => this.headerValues[this.headerValues.length - 1].parseChar(), () => this.columns++, () => {
        this.parsingState = TableParsingState.divider;
        return AfterParseResult.consumed;
      });
    } else if (this.parsingState === TableParsingState.divider) {
      if (this.dividerParsingState === DividerParsingState.pipe) {
        if (/^\| *\n/.test(this.cursor.remainingText)) {
          this.dividerParsingState = DividerParsingState.completed;
        } else
          this.dividerParsingState = DividerParsingState.firstChar;
      } else if (this.dividerParsingState === DividerParsingState.firstChar) {
        if (this.cursor.currentChar === ":") {
          this.columnAlignment[this.currentColumn] = "left";
          if (this.cursor.remainingText[2] === "|")
            this.dividerParsingState = DividerParsingState.lastChar;
          else
            this.dividerParsingState = DividerParsingState.spacer;
        } else {
          if (this.cursor.remainingText[1] === "|") {
            this.dividerParsingState = DividerParsingState.pipe;
            this.currentColumn++;
          } else if (this.cursor.remainingText[2] === "|")
            this.dividerParsingState = DividerParsingState.lastChar;
          else
            this.dividerParsingState = DividerParsingState.spacer;
        }
      } else if (this.dividerParsingState === DividerParsingState.spacer) {
        if (this.cursor.remainingText[2] === "|")
          this.dividerParsingState = DividerParsingState.lastChar;
      } else if (this.dividerParsingState === DividerParsingState.lastChar) {
        if (this.cursor.currentChar === ":") {
          if (this.columnAlignment[this.currentColumn] === "left")
            this.columnAlignment[this.currentColumn] = "center";
          else
            this.columnAlignment[this.currentColumn] = "right";
        }
        this.dividerParsingState = DividerParsingState.pipe;
        this.currentColumn++;
      } else if (this.dividerParsingState === DividerParsingState.completed) {
        if (this.cursor.currentChar === "\n") {
          if (P_Table.countRowPipes(this.cursor.nextLine) >= 2) {
            this.dataRowParsingState = DataRowParsingState.pipe;
            this.parsingState = TableParsingState.rows;
            this.currentColumn = 0;
            this.cellValues.push([]);
          } else
            return AfterParseResult.ended;
        }
      }
      return AfterParseResult.consumed;
    } else if (this.parsingState === TableParsingState.rows) {
      return this.parseDataRow(() => this.cellValues[this.currentRow].push(new P_BasicText(this.cursor, { allowLinks: true })), () => this.cellValues[this.currentRow][this.currentColumn].parseChar(), () => this.currentColumn++, () => {
        if (P_Table.countRowPipes(this.cursor.nextLine) < 2)
          return AfterParseResult.ended;
        else {
          this.currentRow++;
          this.currentColumn = 0;
          this.dataRowParsingState = DataRowParsingState.pipe;
          this.cellValues.push([]);
          return AfterParseResult.consumed;
        }
      });
    }
    return AfterParseResult.consumed;
  }
  toHtmlString() {
    let out = "<table><thead>\n<tr>\n";
    for (let i = 0; i < this.columns; ++i) {
      out += `<th${this.columnAlignment[i] ? ` align="${this.columnAlignment[i]}"` : ""}>${this.headerValues[i].toHtmlString()}</th>
`;
    }
    out += `</tr>
</thead><tbody>
`;
    for (const row of this.cellValues) {
      out += `<tr>
`;
      for (let i = 0; i < this.columns; ++i) {
        const colspan = !row[i] && i + 1 !== this.columns ? ` colspan="${this.columns - i}"` : "";
        const align = this.columnAlignment[i] ? ` align="${this.columnAlignment[i]}"` : "";
        const phantomSpace = colspan && align ? " " : "";
        out += `<td${colspan}${phantomSpace}${align}>${row[i]?.toHtmlString() ?? ""}</td>
`;
        if (colspan)
          break;
      }
      out += `</tr>
`;
    }
    out += `</tbody></table>`;
    return out;
  }
  parseDataRow(onInitContent, onParseChar, onColumnCompleted, onRowCompleted) {
    if (this.dataRowParsingState === DataRowParsingState.pipe) {
      if (/^\|\s*(\n|$)/.test(this.cursor.remainingText)) {
        this.dataRowParsingState = DataRowParsingState.completed;
      } else {
        onInitContent();
        if (this.cursor.remainingText[1] === " ")
          this.dataRowParsingState = DataRowParsingState.leadingWs;
        else if (this.cursor.remainingText[1] === "|") {
          onColumnCompleted();
          this.dataRowParsingState = DataRowParsingState.pipe;
        } else if (/^\| *\n/.test(this.cursor.remainingText))
          this.dataRowParsingState = DataRowParsingState.completed;
        else
          this.dataRowParsingState = DataRowParsingState.content;
      }
    } else if (this.dataRowParsingState === DataRowParsingState.leadingWs) {
      if (this.cursor.remainingText[1] === "|") {
        this.dataRowParsingState = DataRowParsingState.pipe;
        onColumnCompleted();
      } else if (this.cursor.remainingText[1] !== " ")
        this.dataRowParsingState = DataRowParsingState.content;
    } else if (this.dataRowParsingState === DataRowParsingState.content) {
      this.cursor.isNewNode = true;
      onParseChar();
      if (this.cursor.remainingText[1] === "|" && this.cursor.currentChar !== "\\") {
        this.dataRowParsingState = DataRowParsingState.pipe;
        onColumnCompleted();
      } else if (/^. *(?<!\\)\|/.test(this.cursor.remainingText))
        this.dataRowParsingState = DataRowParsingState.end;
    } else if (this.dataRowParsingState === DataRowParsingState.end) {
      if (this.cursor.remainingText[1] === "|") {
        onColumnCompleted();
        if (/^ *\| *\n/.test(this.cursor.remainingText))
          this.dataRowParsingState = DataRowParsingState.completed;
        else
          this.dataRowParsingState = DataRowParsingState.pipe;
      }
    } else if (this.dataRowParsingState === DataRowParsingState.completed) {
      if (this.cursor.currentChar === "\n")
        return onRowCompleted();
    }
    return AfterParseResult.consumed;
  }
  static countRowPipes(row) {
    return row?.match(/(?<!\\)\|/g)?.length ?? 0;
  }
};

// src/parsers/P_List.js
var ListParsingState;
(function(ListParsingState2) {
  ListParsingState2[ListParsingState2["start"] = 0] = "start";
  ListParsingState2[ListParsingState2["whitespace"] = 1] = "whitespace";
  ListParsingState2[ListParsingState2["content"] = 2] = "content";
  ListParsingState2[ListParsingState2["blankLine"] = 3] = "blankLine";
})(ListParsingState || (ListParsingState = {}));
var ContentParsingState;
(function(ContentParsingState2) {
  ContentParsingState2[ContentParsingState2["text"] = 0] = "text";
  ContentParsingState2[ContentParsingState2["blocks"] = 1] = "blocks";
  ContentParsingState2[ContentParsingState2["sublist"] = 2] = "sublist";
})(ContentParsingState || (ContentParsingState = {}));
var P_List = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "list";
    this.canChildrenRepeat = true;
    this.possibleChildren = [ParserType.from(P_Block, ["list"])];
    this.listType = null;
    this.parsingState = ListParsingState.start;
    this.contentParsingState = ContentParsingState.text;
    this.trimNextLine = false;
    this.entries = [];
    this.currentEntry = null;
    this.parsedIndents = 0;
    this.makeNewBlock = false;
    this.isNewLine = true;
    this.currentLineBackup = "";
    this.nextLineBackup = "";
  }
  canStart() {
    if (this.cursor.column !== 0)
      return false;
    for (const listType of P_List.listTypes) {
      if (listType.initialStartRegex.test(this.cursor.currentLine))
        return true;
    }
    return false;
  }
  parseChar() {
    if (this.listType === null) {
      for (const listType of P_List.listTypes) {
        if (listType.initialStartRegex.test(this.cursor.currentLine)) {
          this.listType = listType;
          break;
        }
      }
    }
    if (this.parsingState === ListParsingState.start) {
      if (this.cursor.column === 0) {
        this.currentLineBackup = this.cursor.currentLine;
        this.nextLineBackup = this.cursor.nextLine;
      }
      const startChars = this.currentLineBackup.match(this.listType.startRegex)[0];
      if (startChars.length - 1 === this.cursor.column) {
        this.parsingState = ListParsingState.content;
        this.contentParsingState = ContentParsingState.text;
        this.entries.push({
          textOnly: new P_BasicText(this.cursor, { allowLinks: true }),
          blocks: []
        });
        this.currentEntry = this.entries[this.entries.length - 1];
        this.cursor.currentLine = this.currentLineBackup.slice(startChars.length);
        this.currentLineBackup = this.cursor.currentLine;
        this.cursor.column -= startChars.length;
      }
    } else if (this.parsingState === ListParsingState.whitespace) {
      this.parsedIndents++;
      if (this.parsedIndents === this.listType.indentation) {
        this.parsingState = ListParsingState.content;
        this.trimNextLine = true;
        this.parsedIndents = 0;
      }
    } else if (this.parsingState === ListParsingState.content) {
      if (this.trimNextLine) {
        this.cursor.currentLine = this.cursor.currentLine.slice(this.listType.indentation);
        this.currentLineBackup = this.cursor.currentLine;
        this.nextLineBackup = this.cursor.nextLine;
        this.cursor.column -= this.listType.indentation;
        this.trimNextLine = false;
      }
      if (this.cursor.currentChar === "\n" && !(this.isNextLineStillIndented() || this.isNextLineNewEntry())) {
        if (this.isNextLineBlankLine())
          this.parsingState = ListParsingState.blankLine;
        else
          return AfterParseResult.ended;
      } else if (this.contentParsingState === ContentParsingState.text) {
        this.currentEntry.textOnly.parseChar();
        if (this.cursor.currentChar === "\n") {
          if (this.isNextLineNewEntry())
            this.parsingState = ListParsingState.start;
          else if (this.isNextLineNestedList()) {
            this.parsingState = ListParsingState.whitespace;
            this.isNewLine = true;
            this.contentParsingState = ContentParsingState.sublist;
          } else if (/^\s*\n/.test(this.currentLineBackup) && this.isNextLineStillIndented() && !this.isNextLineNewEntry() && !this.isNextLineNestedList()) {
            this.parsingState = ListParsingState.whitespace;
            this.contentParsingState = ContentParsingState.blocks;
            const firstParagraph = new P_Paragraph(this.cursor);
            firstParagraph.children = [this.currentEntry.textOnly];
            const firstBlock = this.possibleChildren[0].make(this.cursor);
            firstBlock.children = [firstParagraph];
            this.currentEntry.blocks.push(firstBlock);
            this.currentEntry.textOnly = void 0;
            this.makeNewBlock = true;
          } else
            this.parsingState = ListParsingState.whitespace;
        }
      } else if (this.contentParsingState === ContentParsingState.blocks) {
        if (this.cursor.currentChar === "\n") {
          this.parsingState = ListParsingState.whitespace;
          if (this.isNextLineNewEntry()) {
            this.isNewLine = true;
            this.parsingState = ListParsingState.start;
            this.contentParsingState = ContentParsingState.text;
          } else if (this.isNextLineNestedList()) {
            this.isNewLine = true;
            this.contentParsingState = ContentParsingState.sublist;
          }
        }
        if (this.makeNewBlock) {
          const newBlock = this.possibleChildren[0].make(this.cursor);
          if (newBlock.canStart())
            this.currentEntry.blocks.push(newBlock);
          else if (this.isNextLineBlankLine())
            this.parsingState = ListParsingState.blankLine;
          else
            return AfterParseResult.ended;
        }
        const parseResult = this.currentEntry.blocks[this.currentEntry.blocks.length - 1].parseChar();
        this.makeNewBlock = parseResult === AfterParseResult.ended;
      } else if (this.contentParsingState === ContentParsingState.sublist) {
        if (!this.currentEntry.sublist)
          this.currentEntry.sublist = new P_List(this.cursor);
        if (this.isNewLine) {
          if (this.isNextLineStillIndented())
            this.cursor.nextLine = this.nextLineBackup.slice(this.listType.indentation);
          this.isNewLine = false;
        }
        if (this.cursor.currentChar === "\n") {
          this.isNewLine = true;
          if (this.isNextLineStillIndented())
            this.parsingState = ListParsingState.whitespace;
          else if (this.isNextLineNewEntry())
            this.parsingState = ListParsingState.start;
        }
        this.currentEntry.sublist.parseChar();
        return AfterParseResult.consumed;
      }
    } else if (this.parsingState === ListParsingState.blankLine) {
      if (this.cursor.currentChar === "\n") {
        this.currentLineBackup = this.cursor.currentLine;
        this.nextLineBackup = this.cursor.nextLine;
        this.isNewLine = true;
        if (this.isNextLineNewEntry())
          this.parsingState = ListParsingState.start;
        else if (this.isNextLineNewEntry())
          this.parsingState = ListParsingState.start;
        else if (this.isNextLineStillIndented() && this.currentEntry.sublist)
          this.parsingState = ListParsingState.whitespace;
        else if (this.isNextLineBlankLine()) {
        } else
          return AfterParseResult.ended;
      }
    }
    return AfterParseResult.consumed;
  }
  toHtmlString() {
    let out = `<${this.listType.tagName}>
`;
    out += this.entries.map((entry) => {
      let text = `<li>`;
      if (entry.textOnly)
        text += entry.textOnly.toHtmlString().replace(/^\s+|\s+$/, "");
      text += entry.blocks.map((block) => block.toHtmlString()).join("\n\n");
      if (entry.sublist)
        text += "\n\n" + entry.sublist.toHtmlString();
      text += `</li>`;
      return text;
    }).join("\n");
    out += `
</${this.listType.tagName}>`;
    return out;
  }
  isNextLineNewEntry() {
    return this.nextLineBackup ? this.listType.startRegex.test(this.nextLineBackup) : false;
  }
  isNextLineNestedList() {
    let line = this.nextLineBackup;
    if (!line || !line.startsWith(" ".repeat(this.listType.indentation)))
      return false;
    line = line.slice(this.listType.indentation);
    for (const listType of P_List.listTypes) {
      if (listType.initialStartRegex.test(line))
        return true;
    }
    return this.currentEntry.sublist?.isNextLineList();
  }
  isNextLineStillIndented() {
    return this.nextLineBackup ? this.nextLineBackup.startsWith(" ".repeat(this.listType.indentation)) : false;
  }
  isNextLineList() {
    return this.isNextLineNewEntry() || this.isNextLineStillIndented() && this.currentEntry?.sublist?.isNextLineList();
  }
  isNextLineBlankLine() {
    return /^\s*\n/.test(this.cursor.nextLine);
  }
};
P_List.listTypes = [
  {
    initialStartRegex: /^[*-] /,
    startRegex: /^[*-] /,
    indentation: 2,
    tagName: "ul"
  },
  {
    initialStartRegex: /^1\. /,
    startRegex: /^\d+\. /,
    indentation: 3,
    tagName: "ol"
  }
];

// src/parsers/P_Block.js
var P_Block = class extends P_Parser {
  constructor(cursor, excludedTypeIds = []) {
    super(cursor);
    this.id = "block";
    this.possibleChildren = [
      ParserType.from(P_Quote),
      ParserType.from(P_Table),
      ParserType.from(P_List),
      ParserType.from(P_CodeMultilineSpaces),
      ParserType.from(P_CodeMultilineFenced),
      ParserType.from(P_Heading),
      ParserType.from(P_HorizontalLine),
      ParserType.from(P_Paragraph)
    ];
    this.hasBlockStarted = false;
    for (const excludedId of excludedTypeIds) {
      const possibleChildrenIndex = this.possibleChildren.findIndex((parser) => {
        const newParser = parser.make(null);
        return newParser.id === excludedId;
      });
      this.possibleChildren.splice(possibleChildrenIndex, 1);
    }
  }
  parseChar() {
    if (!this.hasBlockStarted) {
      if (/^\s*\n$/.test(this.cursor.currentLine))
        return AfterParseResult.consumed;
      this.hasBlockStarted = true;
    }
    return super.parseChar();
  }
};

// src/parsers/P_Root.js
var P_Root = class extends P_Parser {
  constructor() {
    super(...arguments);
    this.id = "root";
    this.possibleChildren = [ParserType.from(P_Block)];
    this.canChildrenRepeat = true;
    this.joinChars = "\n\n";
  }
};

// src/parsingCursor.js
var ParsingCursor = class {
  constructor(markdown) {
    this.row = 0;
    this.column = 0;
    this.charIndex = 0;
    this.previousChar = "";
    this.previousText = "";
    this.isNewNode = false;
    this.allText = markdown;
    this.allLines = markdown.split("\n").map((line) => `${line}
`);
    this.currentLine = this.allLines[0];
    this.nextLine = this.allLines[1] ?? null;
    this.remainingText = markdown;
    this.currentChar = markdown[0];
    this.isLastChar = markdown.length < 2;
  }
  incrementCursor() {
    this.charIndex++;
    this.column++;
    this.currentChar = this.allText[this.charIndex];
    this.previousChar = this.allText[this.charIndex - 1];
    this.previousText = this.allText.slice(0, this.charIndex);
    this.remainingText = this.allText.slice(this.charIndex);
    this.isLastChar = this.charIndex + 1 === this.allText.length;
    this.isNewNode = false;
    if (this.column === this.currentLine.length) {
      this.row++;
      this.column = 0;
      this.currentLine = this.allLines[this.row];
      this.nextLine = this.allLines[this.row + 1] ?? null;
    }
  }
};

// src/main.ts
function parseMarkdown(markdown) {
  markdown = markdown.replace(/^(\s*\n)*|(\s*\n)*$|(?<=\n)\s*$/g, "");
  const cursor = new ParsingCursor(markdown);
  const rootParser = new P_Root(cursor);
  let parseResult;
  while (cursor.charIndex !== cursor.allText.length) {
    parseResult = rootParser.parseChar();
    cursor.incrementCursor();
  }
  return rootParser.toHtmlString();
}
export {
  parseMarkdown
};
