"use client";

import { useActionState, useState } from "react";

import { saveProfileAction } from "@/actions/profile-actions";
import { POSITION_LABELS, ROLE_PROFILES, IMPLEMENTED_ROLES } from "@/lib/domain/positions";
import { POSITIONS } from "@/lib/domain/types";
import type { PlayerProfile, Position } from "@/lib/domain/types";

export function ProfileForm({ profile }: { profile: PlayerProfile }) {
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const [primary, setPrimary] = useState<Position>(profile.primaryPosition);
  const [secondary, setSecondary] = useState<Position[]>(profile.secondaryPositions);

  const roles = ROLE_PROFILES.filter((r) => r.appliesTo.includes(primary));
  const selectableRoles = roles.length > 0 ? roles : ROLE_PROFILES.filter((r) => r.role === "GENERALIST");

  return (
    <form action={action} className="space-y-6">
      <div>
        <label className="pz-label mb-2" htmlFor="displayName">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          className="pz-input"
          defaultValue={profile.displayName}
        />
      </div>

      <div>
        <span className="pz-label mb-2">Primary position</span>
        <div className="grid grid-cols-4 gap-2">
          {POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => {
                setPrimary(position);
                setSecondary((current) => current.filter((p) => p !== position));
              }}
              className={`min-h-[48px] rounded-xl border font-mono text-sm font-semibold transition ${
                primary === position
                  ? "border-signal bg-signal/15 text-signal"
                  : "border-ink-700 bg-ink-900 text-chalk-500"
              }`}
            >
              {position}
            </button>
          ))}
        </div>
        <input type="hidden" name="primaryPosition" value={primary} />
        <p className="mt-2 text-xs text-chalk-600">{POSITION_LABELS[primary]}</p>
      </div>

      <div>
        <span className="pz-label mb-2">Secondary positions (max 4)</span>
        <div className="grid grid-cols-4 gap-2">
          {POSITIONS.filter((p) => p !== primary).map((position) => {
            const active = secondary.includes(position);
            return (
              <button
                key={position}
                type="button"
                onClick={() =>
                  setSecondary((current) =>
                    active
                      ? current.filter((p) => p !== position)
                      : current.length < 4
                        ? [...current, position]
                        : current,
                  )
                }
                className={`min-h-[44px] rounded-xl border font-mono text-xs transition ${
                  active
                    ? "border-chalk-500 bg-ink-700 text-chalk-100"
                    : "border-ink-700 bg-ink-900 text-chalk-600"
                }`}
              >
                {position}
              </button>
            );
          })}
        </div>
        {secondary.map((position) => (
          <input key={position} type="hidden" name="secondaryPositions" value={position} />
        ))}
      </div>

      <div>
        <label className="pz-label mb-2" htmlFor="preferredRole">
          Role
        </label>
        <select
          id="preferredRole"
          name="preferredRole"
          className="pz-input"
          defaultValue={profile.preferredRole}
        >
          {selectableRoles.map((role) => (
            <option key={role.role} value={role.role}>
              {role.label}
              {IMPLEMENTED_ROLES.includes(role.role) ? "" : " (not weighted yet)"}
            </option>
          ))}
        </select>
        <ul className="mt-3 space-y-2">
          {selectableRoles.map((role) => (
            <li key={role.role} className="text-xs text-chalk-600">
              <span className="font-semibold text-chalk-500">{role.label}</span> —{" "}
              {role.description}
            </li>
          ))}
        </ul>
      </div>

      {state ? (
        <p className={`text-sm ${state.ok ? "text-signal" : "text-alert"}`}>
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="pz-button" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
