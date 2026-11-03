interface SummaryScreenProps {
  completed: number;
}

export function SummaryScreen({ completed }: SummaryScreenProps) {
  return (
    <section className="screen summary-screen" aria-labelledby="summary-heading">
      <p className="eyebrow">Simulation complete</p>
      <h1 id="summary-heading">Thank you</h1>
      <p>You completed {completed} scenarios.</p>
    </section>
  );
}
