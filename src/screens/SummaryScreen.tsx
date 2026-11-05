interface SummaryScreenProps {
  completed: number;
  onNewSession?: () => void;
}

export function SummaryScreen({ completed, onNewSession }: SummaryScreenProps) {
  return (
    <section className="screen summary-screen" aria-labelledby="summary-heading">
      <p className="eyebrow">Simulation complete</p>
      <h1 id="summary-heading">Thank you</h1>
      <p>You completed {completed} trial{completed === 1 ? '' : 's'}.</p>
      {onNewSession && <button className="primary-button" type="button" onClick={onNewSession}>Start a new session</button>}
    </section>
  );
}
