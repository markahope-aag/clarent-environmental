'use client';

import { useActionState } from 'react';
import {
  createGeneratorOrganizationAction,
  type OnboardingFormState,
} from './actions';

const initialState: OnboardingFormState = { ok: false };

const fieldClass =
  'w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-black/30 focus:ring-2 focus:ring-black/5';

const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-700';

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    createGeneratorOrganizationAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="businessName" className={labelClass}>
          Business name
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          required
          autoComplete="organization"
          placeholder="ABC Auto Repair"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="generatorClass" className={labelClass}>
            Generator class
          </label>
          <select
            id="generatorClass"
            name="generatorClass"
            defaultValue=""
            className={fieldClass}
          >
            <option value="">Not sure yet</option>
            <option value="VSQG">VSQG (&lt; 100 kg/mo)</option>
            <option value="SQG">SQG (100–1,000 kg/mo)</option>
            <option value="LQG">LQG (&gt; 1,000 kg/mo)</option>
          </select>
        </div>
        <div>
          <label htmlFor="industry" className={labelClass}>
            Industry
          </label>
          <input
            id="industry"
            name="industry"
            type="text"
            placeholder="Auto repair, dental, manufacturing…"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="addressLine1" className={labelClass}>
          Street address
        </label>
        <input
          id="addressLine1"
          name="addressLine1"
          type="text"
          autoComplete="street-address"
          placeholder="1234 Main St"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-[1fr_80px_100px] gap-4">
        <div>
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            autoComplete="address-level2"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="state" className={labelClass}>
            State
          </label>
          <input
            id="state"
            name="state"
            type="text"
            required
            maxLength={2}
            autoComplete="address-level1"
            placeholder="WI"
            className={`${fieldClass} uppercase`}
          />
        </div>
        <div>
          <label htmlFor="postalCode" className={labelClass}>
            ZIP
          </label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            className={fieldClass}
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
