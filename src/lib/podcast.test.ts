import { describe, expect, it } from "vitest";
import { parseFeed } from "./podcast";

const xml = `<rss><channel><title>Show</title>
<item>
  <title><![CDATA[Ep 1 & more]]></title>
  <description><![CDATA[<p>Hallo <strong>wereld</strong></p><p>Twee &amp; drie</p>]]></description>
  <guid isPermaLink="false">abc-1</guid>
  <pubDate>Thu, 17 Sep 2026 03:00:00 GMT</pubDate>
  <enclosure url="https://x.test/a.mp3?x=1&amp;y=2" length="1" type="audio/mpeg"/>
  <itunes:duration>01:42:18</itunes:duration>
  <itunes:image href="https://x.test/a.jpg"/>
</item>
<item><title>No audio</title></item>
</channel></rss>`;

describe("parseFeed", () => {
  it("parses items with enclosure and skips ones without", () => {
    const eps = parseFeed(xml);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({
      guid: "abc-1",
      title: "Ep 1 & more",
      description: "Hallo wereld\n\nTwee & drie",
      audioUrl: "https://x.test/a.mp3?x=1&y=2",
      imageUrl: "https://x.test/a.jpg",
      duration: "01:42:18",
    });
    expect(eps[0].publishedAt.toISOString()).toBe("2026-09-17T03:00:00.000Z");
  });
});
