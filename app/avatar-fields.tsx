import {
  accessoryOptions, bodyTypes, eyewearOptions, faceDetails, hairColors,
  hairStyleGroups, hairStyles, headwearOptions, skinTones, type AvatarLook,
} from "./avatar-options";

function SelectField<Key extends string>({ label, options, groups, value, onChange }: {
  label: string;
  options: Record<Key, string>;
  groups?: readonly { label: string; keys: readonly Key[] }[];
  value: Key;
  onChange: (value: Key) => void;
}) {
  const selectedGroup = groups?.find(({ keys }) => keys.includes(value))?.label;

  function renderOptions(keys: readonly Key[]) {
    return keys.map((key) => <option key={key} value={key}>{options[key]}</option>);
  }

  return (
    <label className="avatar-field">
      <span className="avatar-field-label">
        {label}{selectedGroup && <>{" "}<span className="field-value">{selectedGroup}</span></>}
      </span>
      <span className="avatar-select">
        <select value={value} onChange={(event) => onChange(event.target.value as Key)}>
          {groups ? groups.map((group) => (
            <optgroup key={group.label} label={group.label}>{renderOptions(group.keys)}</optgroup>
          )) : renderOptions(Object.keys(options) as Key[])}
        </select>
      </span>
    </label>
  );
}

function SwatchField<Key extends string>({ label, name, options, value, onChange }: {
  label: string;
  name: string;
  options: Record<Key, { label: string; base: string }>;
  value: Key;
  onChange: (value: Key) => void;
}) {
  return (
    <fieldset className="avatar-field">
      <legend>{label} <span className="field-value">{options[value].label}</span></legend>
      <div className="avatar-swatches">
        {(Object.keys(options) as Key[]).map((key) => (
          <label className="swatch-option" key={key} title={options[key].label}>
            <input
              type="radio"
              name={name}
              aria-label={options[key].label}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <span style={{ backgroundColor: options[key].base }} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function AvatarFields({ look, onChange }: {
  look: AvatarLook;
  onChange: (look: AvatarLook) => void;
}) {
  function update<Part extends keyof AvatarLook>(part: Part, value: AvatarLook[Part]) {
    onChange({ ...look, [part]: value });
  }

  return (
    <div className="avatar-fields">
      <fieldset className="cosmetic-fields">
        <legend>Cosmetics</legend>
        <div className="avatar-field-pair">
          <SelectField label="Glasses" options={eyewearOptions} value={look.eyewear} onChange={(value) => update("eyewear", value)} />
          <SelectField label="Headwear" options={headwearOptions} value={look.headwear} onChange={(value) => update("headwear", value)} />
        </div>
        <SelectField label="Accessory" options={accessoryOptions} value={look.accessory} onChange={(value) => update("accessory", value)} />
      </fieldset>

      <fieldset className="avatar-field">
        <legend>Body type</legend>
        <div className="avatar-segment">
          {(Object.keys(bodyTypes) as AvatarLook["body"][]).map((body) => (
            <label key={body}>
              <input
                type="radio"
                name="body"
                value={body}
                checked={look.body === body}
                onChange={() => update("body", body)}
              />
              <span>{bodyTypes[body]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <SwatchField label="Skin tone" name="skin" options={skinTones} value={look.skin} onChange={(value) => update("skin", value)} />
      <SelectField label="Hairstyle" options={hairStyles} groups={hairStyleGroups} value={look.hair} onChange={(value) => update("hair", value)} />
      <SwatchField label="Hair color" name="hair-color" options={hairColors} value={look.color} onChange={(value) => update("color", value)} />
      <SelectField label="Face detail" options={faceDetails} value={look.detail} onChange={(value) => update("detail", value)} />
    </div>
  );
}
