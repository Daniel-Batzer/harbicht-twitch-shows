import { motion } from "motion/react";
import styles from "./ChatVoteHint.module.scss";

type ChatVoteHintProps = {
  optionCount: number;
};

// Shown while voting is open: how to vote in chat. The numbers match the
// badges on the answer cards (findOptionIdByNumber), so a fourth option
// would get `!vote 4` automatically.
export function ChatVoteHint({ optionCount }: ChatVoteHintProps) {
  const optionNumbers = Array.from({ length: optionCount }, (_, index) => index + 1);

  return (
    <motion.p
      className={styles.hint}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.4 }}
    >
      <span className={styles.label}>Vote in chat</span>
      {optionNumbers.map((optionNumber) => (
        <span key={optionNumber} className={styles.command} data-slot={((optionNumber - 1) % 3) + 1}>
          !vote {optionNumber}
        </span>
      ))}
    </motion.p>
  );
}
