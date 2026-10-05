import * as copy from '../../core/copy';
import { PACK_ICONS } from '../../core/pack';
import type { PackIcon } from '../../core/types';
import Glyph from './Glyph';

/** The pack drawings as one choice: a ring per drawing with its name under it.
 *  They are native radio buttons, so arrow keys, the keyboard and a screen
 *  reader treat it as any other single choice. */
export default function IconPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: PackIcon;
  onChange: (icon: PackIcon) => void;
}) {
  return (
    <fieldset className="icon-picker">
      <legend>{copy.PACK_ICON_LABEL}</legend>
      {PACK_ICONS.map((icon) => (
        <label key={icon} className="icon-choice">
          <input type="radio" name={name} value={icon} checked={value === icon} onChange={() => onChange(icon)} />
          <Glyph kind={icon} />
          {copy.PACK_ICON_NAMES[icon]}
        </label>
      ))}
    </fieldset>
  );
}
