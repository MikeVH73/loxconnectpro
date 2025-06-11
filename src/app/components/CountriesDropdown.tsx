"use client";
import { useCountries } from "../hooks/useCountries";

interface CountriesDropdownProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
}

export default function CountriesDropdown({
  value,
  onChange,
  className = "w-full border rounded px-3 py-2",
  placeholder = "Select country",
  required = false,
  disabled = false,
  allowEmpty = true
}: CountriesDropdownProps) {
  const { countries, loading, error } = useCountries();

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Loading countries...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select className={className} disabled>
        <option>Error loading countries</option>
      </select>
    );
  }

  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {countries.map((country) => (
        <option key={country.id} value={country.name}>
          {country.name}
        </option>
      ))}
    </select>
  );
} 