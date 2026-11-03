import { FormEvent } from 'react';
import type { ParticipantMode } from '../App';

interface StartScreenProps {
  participantCode: string;
  onParticipantCodeChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  modeOrder: ParticipantMode[];
  onModeOrderChange: (order: ParticipantMode[]) => void;
  onStart: () => void;
}

export function StartScreen({
  participantCode,
  onParticipantCodeChange,
  consent,
  onConsentChange,
  modeOrder,
  onModeOrderChange,
  onStart,
}: StartScreenProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (consent) onStart();
  }

  return (
    <section className="screen start-screen">
      <header className="screen-heading">
        <p className="eyebrow">QRShield</p>
        <h1>Pre-payment safety simulation</h1>
        <p>Review each sample payment request. No real payment will be made.</p>
      </header>

      <form className="start-form" onSubmit={submit}>
        <label className="field-label" htmlFor="participant-code">
          Anonymous participant code
        </label>
        <input
          id="participant-code"
          className="text-input"
          type="text"
          autoComplete="off"
          value={participantCode}
          onChange={event => onParticipantCodeChange(event.target.value)}
          placeholder="Enter your assigned code"
        />
        <p className="field-hint">Do not enter your name or other identifying details.</p>

        <fieldset className="mode-order">
          <legend>Mode order</legend>
          <label className="choice-row">
            <input
              type="radio"
              name="mode-order"
              checked={modeOrder[0] === 'baseline'}
              onChange={() => onModeOrderChange(['baseline', 'qrshield'])}
            />
            <span>Baseline first, then QRShield</span>
          </label>
          <label className="choice-row">
            <input
              type="radio"
              name="mode-order"
              checked={modeOrder[0] === 'qrshield'}
              onChange={() => onModeOrderChange(['qrshield', 'baseline'])}
            />
            <span>QRShield first, then Baseline</span>
          </label>
        </fieldset>

        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={event => onConsentChange(event.target.checked)}
          />
          <span>
            I understand this is a simulation and consent to continue.
          </span>
        </label>

        <button className="primary-button" type="submit" disabled={!consent}>
          Start simulation
        </button>
      </form>
    </section>
  );
}
