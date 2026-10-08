import { motion, stagger, type Variants } from "motion/react";
import { AnswerCard } from "./AnswerCard";
import type { AnswerCardPresentation } from "./round-presentation";
import styles from "./AnswerCards.module.scss";

type AnswerCardsProps = {
  cards: AnswerCardPresentation[];
};

// Cards mount when voting opens, after the question has landed; they come in one after another.
const listEntrance: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(0.14, { startDelay: 0.15 }) } },
};

// Presentation is tuned for three options (Decision 033) but renders any count;
// slot colors cycle in SCSS. The list stays mounted for the whole round, so
// between phases only what is new animates.
export function AnswerCards({ cards }: AnswerCardsProps) {
  return (
    <motion.ol className={styles.cards} variants={listEntrance} initial="hidden" animate="shown">
      {cards.map((card, index) => (
        <AnswerCard key={card.option.id} card={card} index={index} />
      ))}
    </motion.ol>
  );
}
