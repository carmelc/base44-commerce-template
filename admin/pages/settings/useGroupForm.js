import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSettings } from "../../context/SettingsContext";

/**
 * Standard form state for a StoreSettings group page.
 * Initializes from `settings[group]` spread over `defaults` (missing keys safe),
 * tracks dirtiness, and persists through `useSettings().saveGroup`.
 *
 * Returns { form, setField(key, value), setForm(next), dirty, saving, save }.
 */
export default function useGroupForm(group, defaults) {
  const { settings, saveGroup } = useSettings();

  const initial = useMemo(
    () => ({ ...defaults, ...(settings?.[group] || {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, group]
  );

  const [form, setFormState] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync when settings refresh (e.g. after save).
  useEffect(() => {
    setFormState(initial);
    setDirty(false);
  }, [initial]);

  const setField = (key, value) => {
    setFormState((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const setForm = (next) => {
    setFormState(next);
    setDirty(true);
  };

  const save = async (override) => {
    setSaving(true);
    try {
      await saveGroup(group, override || form);
      toast.success("Settings saved");
      setDirty(false);
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return { form, setField, setForm, dirty, saving, save };
}
