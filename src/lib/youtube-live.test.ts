import { describe, expect, it } from "vitest";
import { parseLivePage } from "./youtube-live";

const canon = (href: string) => `<link rel="canonical" href="${href}">`;

describe("parseLivePage", () => {
  it("detects a live broadcast", () => {
    const html = `${canon("https://www.youtube.com/watch?v=3PFJ9SETS4M")}<meta name="title" content="Crypto &amp; co">"isLive":true`;
    expect(parseLivePage(html)).toEqual({ videoId: "3PFJ9SETS4M", title: "Crypto & co" });
  });
  it("ignores an upcoming (not yet live) broadcast", () => {
    expect(parseLivePage(`${canon("https://www.youtube.com/watch?v=3PFJ9SETS4M")}"isUpcoming":true`)).toBeNull();
  });
  it("returns null when the channel is offline", () => {
    expect(parseLivePage(`${canon("https://www.youtube.com/channel/UCBtCkloeBiLTqDqzhCozjGA")}`)).toBeNull();
  });
});
