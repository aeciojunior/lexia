import { useReducedMotion } from "framer-motion";

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export const fadeUpReduced = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export function useLandingMotion() {
  const reduced = useReducedMotion();
  return reduced ? fadeUpReduced : fadeUp;
}
