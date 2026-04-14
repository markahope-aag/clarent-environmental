'use client';

import { SignInButton } from '@clerk/nextjs';
import { useActionState } from 'react';
import { submitIntakeAction, type IntakeFormState } from './actions';

type WasteStreamOption = {
  key: string;
  name: string;
  framework: string;
  lane: 'lane_1' | 'lane_2' | 'both';
};

type Prefill = {
  businessName: string;
  industry: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
};

type Props = {
  streams: WasteStreamOption[];
  prefill: Prefill | null;
  isSignedIn: boolean;
};

const initialState: IntakeFormState = { ok: false };

const fieldClass =
  'w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-black/30 focus:ring-2 focus:ring-black/5 disabled:bg-zinc-50 disabled:text-zinc-500';

const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-700';

const CONTAINER_OPTIONS = [
  { value: '55gal_drum', label: '55-gallon drum' },
  { value: '30gal_drum', label: '30-gallon drum' },
  { value: '5gal_pail', label: '5-gallon pail' },
  { value: '275gal_tote', label: '275-gallon tote' },
  { value: 'lamp_box', label: 'Lamp box' },
  { value: 'other', label: 'Other' },
];

export default function IntakeForm({ streams, prefill, isSignedIn }: Props) {
  const [state, formAction, pending] = useActionState(submitIntakeAction, initialState);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      {/* Prominent sign-in banner for anonymous visitors */}
      {!isSignedIn && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-black/10 bg-zinc-50 px-4 py-3">
          <div className="text-sm text-zinc-700">
            <span className="font-semibold">Have an account?</span> Sign in to skip this form.
          </div>
          <SignInButton>
            <button className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800">
              Sign in
            </button>
          </SignInButton>
        </div>
      )}

      <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Generator portal · Pickup request
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Tell us what needs picking up.
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        We&rsquo;ll match your waste to a licensed vendor and come back with a quote.
        {!isSignedIn && (
          <>
            {' '}
            <span className="font-medium text-zinc-900">
              A Clarent account will be created for you after you submit
            </span>{' '}
            — no separate sign-up needed.
          </>
        )}
      </p>

      {state.ok && state.message && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {state.message}
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-6">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Business
          </legend>
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
              defaultValue={prefill?.businessName ?? ''}
              readOnly={isSignedIn}
              className={fieldClass}
              placeholder="ABC Auto Repair"
            />
          </div>

          <div>
            <label htmlFor="industry" className={labelClass}>
              Industry
            </label>
            <input
              id="industry"
              name="industry"
              type="text"
              defaultValue={prefill?.industry ?? ''}
              placeholder="Auto repair, dental, manufacturing…"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="addressLine1" className={labelClass}>
              Pickup street address
            </label>
            <input
              id="addressLine1"
              name="addressLine1"
              type="text"
              autoComplete="street-address"
              defaultValue={prefill?.addressLine1 ?? ''}
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
                defaultValue={prefill?.city ?? ''}
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
                defaultValue={prefill?.state ?? ''}
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
                defaultValue={prefill?.postalCode ?? ''}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contactPhone" className={labelClass}>
              Contact phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              autoComplete="tel"
              defaultValue={prefill?.phone ?? ''}
              placeholder="(555) 555-0123"
              className={fieldClass}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Waste
            <span className="text-[10px] font-normal tracking-normal normal-case text-zinc-400">
              Optional — skip if you just want to set up an account
            </span>
          </legend>
          <div>
            <label htmlFor="wasteStreamKey" className={labelClass}>
              Waste type
            </label>
            <select
              id="wasteStreamKey"
              name="wasteStreamKey"
              defaultValue=""
              className={fieldClass}
            >
              <option value="">Select a waste type</option>
              {streams.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="containerType" className={labelClass}>
                Container type
              </label>
              <select
                id="containerType"
                name="containerType"
                defaultValue=""
                className={fieldClass}
              >
                <option value="">Select a container</option>
                {CONTAINER_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="containerCount" className={labelClass}>
                How many?
              </label>
              <input
                id="containerCount"
                name="containerCount"
                type="number"
                min={1}
                defaultValue={1}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything we should know about this waste — condition, labels, timing…"
              className={fieldClass}
            />
          </div>
        </fieldset>

        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            name="intent"
            value="pickup_request"
            disabled={pending}
            className="inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {pending
              ? isSignedIn
                ? 'Submitting…'
                : 'Creating your account…'
              : isSignedIn
                ? 'Submit pickup request'
                : 'Submit request & create account'}
          </button>

          {!isSignedIn && (
            <button
              type="submit"
              name="intent"
              value="account_only"
              disabled={pending}
              className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              I just want to create an account — no pickup yet
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
