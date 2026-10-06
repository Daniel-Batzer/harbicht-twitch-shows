import type { Deck } from "../domain/question";

// Static fixture deck for the first local slices (Decision 031).
// Moves to the database once question editing becomes a real requirement.
export const defaultDeck: Deck = {
  id: "default",
  name: "General Would You Rather",
  questions: [
    {
      id: "death-punishment",
      context: "Whenever you die in a game...",
      prompt: "Which punishment would you rather receive?",
      options: [
        { id: "push-ups", label: "10 push-ups" },
        { id: "spicy", label: "Eat something extremely spicy" },
        { id: "lockout", label: "Lose access to the game for 30 minutes" },
      ],
    },
    {
      id: "lose-a-sense",
      prompt: "What would you rather permanently lose?",
      options: [
        { id: "hearing", label: "Hearing" },
        { id: "eyesight", label: "Eyesight" },
        { id: "taste", label: "Sense of taste" },
      ],
    },
    {
      id: "one-game-forever",
      prompt: "For the rest of your life, you may only play...",
      options: [
        { id: "first-game", label: "The first game you ever played" },
        { id: "chat-pick", label: "Whatever chat picks each day" },
        { id: "worst-rated", label: "The worst-rated game of last year" },
      ],
    },
    {
      id: "stream-chaos",
      context: "Every time a new follower arrives...",
      prompt: "What would you rather have to do?",
      options: [
        { id: "sing", label: "Sing the next sentence you say" },
        { id: "accent", label: "Talk in an accent for 5 minutes" },
        { id: "invert", label: "Play with inverted controls for 1 minute" },
      ],
    },
    {
      id: "food-forever",
      prompt: "Which would you rather never eat again?",
      options: [
        { id: "pizza", label: "Pizza" },
        { id: "chocolate", label: "Chocolate" },
        { id: "fries", label: "Fries" },
      ],
    },
    {
      id: "rage-quit",
      context: "Whenever you rage quit...",
      prompt: "What would you rather happen?",
      options: [
        { id: "donate", label: "You donate 5 € to charity" },
        { id: "replay", label: "You must replay the level immediately" },
        { id: "mod-pick", label: "A mod picks your next game" },
      ],
    },
  ],
};
