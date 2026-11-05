import { FormEvent } from 'react';
import type { ParticipantMode } from '../App';
import { isValidParticipantCode } from '../lib/session';

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
    if (consent && isValidParticipantCode(participantCode)) onStart();
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
          maxLength={12}
          onChange={event => onParticipantCodeChange(event.target.value.trim())}
          placeholder="Enter your assigned code"
        />
        <p className="field-hint">Use 2–12 letters, numbers, or hyphens. Do not enter a name.</p>
        {participantCode && !isValidParticipantCode(participantCode) && (
          <p className="form-error" role="alert">Use only 2–12 letters, numbers, or hyphens.</p>
        )}

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
          <span>I understand this is a simulation and consent to continue.</span>
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={!consent || !isValidParticipantCode(participantCode)}
        >
          Start simulation
        </button>
      </form>
    </section>
  );
}
