import Button from "../../components/Button/Button";

interface BestRouteButtonProps {
  onClick: () => void;
  tabIndex?: number;
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * BestRouteButton component
 *
 * This button triggers the reordering of activities in the itinerary
 * to follow the optimal route calculated by the A* algorithm.
 */
export default function BestRouteButton({
  onClick,
  tabIndex,
  "aria-label": ariaLabel,
  children,
}: BestRouteButtonProps) {
  return (
    <Button
      onClick={onClick}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      variant="primary"
    >
      {children}
    </Button>
  );
}