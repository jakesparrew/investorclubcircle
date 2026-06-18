/** Reaction types shared between the server action and the UI. */
export const REACTION_TYPES = ["like", "love", "fire", "clap", "idea"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  fire: "🔥",
  clap: "👏",
  idea: "💡",
};
