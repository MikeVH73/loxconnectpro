"use client";
import { useCountries } from "../hooks/useCountries";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  label?: string;
}

export default function CountrySelect({
  value,
  onChange,
  className = "w-full border rounded px-3 py-2",
  placeholder = "Select country",
  required = false,
  disabled = false,
  allowEmpty = true,
  label
}: CountrySelectProps) {
  const { countries, loading, error } = useCountries();

  if (loading) {
    return (
      <div>
        {label && (
          <label className="block mb-1 font-medium">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <select className={className} disabled>
          <option>Loading countries...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {label && (
          <label className="block mb-1 font-medium">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <select className={className} disabled>
          <option>Error loading countries</option>
        </select>
        <div className="text-xs text-red-500 mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="block mb-1 font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {Array.from(new Set(countries.map((c) => (c.name || '').trim())))
          .sort((a, b) => a.localeCompare(b))
          .map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
      </select>
    </div>
  );
} 