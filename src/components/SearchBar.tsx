import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder = "Search games..." }: Props) {
  return (
    <div className="relative flex items-center">
      <Search size={15} className="absolute left-3 text-sakura-muted pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="sakura-input pl-9 pr-8 h-9"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 text-sakura-muted hover:text-sakura-text transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
