"use client";

import { useTranslation } from "react-i18next";
import { Control, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormValues } from "./types";

interface LocationSelectionSectionProps {
  control: Control<FormValues>;
  accountId: string;
  accounts: Array<{ id: string; steamId64: string; name: string }>;
  storageUnits: Array<{ id: string; name: string; currentCount: number }>;
  handleAccountChange: (val: string) => void;
}

export function LocationSelectionSection({
  control,
  accountId,
  accounts,
  storageUnits,
  handleAccountChange,
}: LocationSelectionSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-muted-foreground"
          htmlFor="account-select"
        >
          {t("portfolio.owningAccounts", "Owning Accounts")}
        </label>
        <Select
          value={accountId || "__manual__"}
          onValueChange={handleAccountChange}
        >
          <SelectTrigger id="account-select" className="h-10">
            <SelectValue placeholder={t("portfolio.manualNoAccount", "Manual (No account selected)")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__manual__">
              {t("portfolio.manualNoAccount", "Manual (No account selected)")}
            </SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name} ({acc.steamId64.substring(0, 4)}...
                {acc.steamId64.substring(13)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-muted-foreground"
          htmlFor="storage-unit-select"
        >
          {t("portfolio.storedInStorageUnit", "Stored in (Storage Unit)")}
        </label>
        <Controller
          control={control}
          name="storageUnitId"
          render={({ field }) => (
            <Select
              value={field.value || "__inventory__"}
              onValueChange={(val) =>
                field.onChange(val === "__inventory__" ? "" : val)
              }
              disabled={!accountId || storageUnits.length === 0}
            >
              <SelectTrigger id="storage-unit-select" className="h-10">
                <SelectValue
                  placeholder={
                    !accountId
                      ? t("portfolio.selectAccountFirst", "Select owning account first")
                      : storageUnits.length === 0
                        ? t("portfolio.noStorageUnitsOnAccount", "Account has no Storage Units")
                        : t("portfolio.regularInventory", "Regular inventory (Inventory)")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__inventory__">
                  {t("portfolio.regularInventory", "Regular inventory (Inventory)")}
                </SelectItem>
                {storageUnits.map((su) => (
                  <SelectItem key={su.id} value={su.id}>
                    {su.name} ({su.currentCount}/1000)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}
