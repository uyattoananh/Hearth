import { useState, useRef, useEffect } from "react";

const EMOJI_LIST = [
  { name: "smile", char: "\u{1F604}" },
  { name: "laughing", char: "\u{1F606}" },
  { name: "joy", char: "\u{1F602}" },
  { name: "heart_eyes", char: "\u{1F60D}" },
  { name: "wink", char: "\u{1F609}" },
  { name: "thinking", char: "\u{1F914}" },
  { name: "thumbsup", char: "\u{1F44D}" },
  { name: "thumbsdown", char: "\u{1F44E}" },
  { name: "fire", char: "\u{1F525}" },
  { name: "100", char: "\u{1F4AF}" },
  { name: "heart", char: "\u{2764}\u{FE0F}" },
  { name: "broken_heart", char: "\u{1F494}" },
  { name: "star", char: "\u{2B50}" },
  { name: "clap", char: "\u{1F44F}" },
  { name: "wave", char: "\u{1F44B}" },
  { name: "pray", char: "\u{1F64F}" },
  { name: "muscle", char: "\u{1F4AA}" },
  { name: "eyes", char: "\u{1F440}" },
  { name: "cry", char: "\u{1F622}" },
  { name: "sob", char: "\u{1F62D}" },
  { name: "angry", char: "\u{1F620}" },
  { name: "skull", char: "\u{1F480}" },
  { name: "ghost", char: "\u{1F47B}" },
  { name: "poop", char: "\u{1F4A9}" },
  { name: "rocket", char: "\u{1F680}" },
  { name: "check", char: "\u{2705}" },
  { name: "x", char: "\u{274C}" },
  { name: "question", char: "\u{2753}" },
  { name: "exclamation", char: "\u{2757}" },
  { name: "ok_hand", char: "\u{1F44C}" },
  { name: "raised_hands", char: "\u{1F64C}" },
  { name: "sunglasses", char: "\u{1F60E}" },
  { name: "nerd", char: "\u{1F913}" },
  { name: "pleading", char: "\u{1F97A}" },
  { name: "partying", char: "\u{1F973}" },
  { name: "shushing", char: "\u{1F92B}" },
  { name: "money_mouth", char: "\u{1F911}" },
  { name: "zany", char: "\u{1F92A}" },
  { name: "cold_sweat", char: "\u{1F630}" },
  { name: "sparkles", char: "\u{2728}" },
  { name: "tada", char: "\u{1F389}" },
  { name: "trophy", char: "\u{1F3C6}" },
  { name: "pizza", char: "\u{1F355}" },
  { name: "coffee", char: "\u{2615}" },
  { name: "beer", char: "\u{1F37A}" },
  { name: "cat", char: "\u{1F431}" },
  { name: "dog", char: "\u{1F436}" },
  { name: "rainbow", char: "\u{1F308}" },
];

export function EmojiGrid({ onPick }) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? EMOJI_LIST.filter((e) => e.name.includes(search.toLowerCase()))
    : EMOJI_LIST;

  return (
    <div className="emoji-grid-popup">
      <input
        className="emoji-search"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <div className="emoji-grid">
        {filtered.map((e) => (
          <span
            key={e.name}
            className="emoji-item"
            title={`:${e.name}:`}
            onClick={() => onPick(e)}
          >
            {e.char}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EmojiAutocomplete({ query, onPick, visible }) {
  if (!visible || !query) return null;
  const matches = EMOJI_LIST.filter((e) =>
    e.name.startsWith(query.toLowerCase())
  ).slice(0, 8);
  if (matches.length === 0) return null;

  return (
    <div className="emoji-autocomplete">
      {matches.map((e, i) => (
        <div
          key={e.name}
          className="emoji-ac-item"
          onClick={() => onPick(e)}
        >
          <span className="emoji-ac-char">{e.char}</span>
          <span className="emoji-ac-name">:{e.name}:</span>
        </div>
      ))}
    </div>
  );
}

export { EMOJI_LIST };
export default EmojiGrid;
