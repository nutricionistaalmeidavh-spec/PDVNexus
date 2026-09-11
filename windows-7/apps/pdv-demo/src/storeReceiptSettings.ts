export interface StoreReceiptSettingsInput {
  storeName: string;
  phone: string;
  address: string;
  showOnReceipt: boolean;
}

export interface StoreReceiptHeader {
  storeName: string;
  address?: string;
  phone?: string;
}

export function resolveReceiptStoreHeader(settings: StoreReceiptSettingsInput): StoreReceiptHeader {
  if (!settings.showOnReceipt) return { storeName: "PDV Nexus" };

  const storeName = settings.storeName.trim() || "PDV Nexus";
  const address = settings.address.trim();
  const phone = settings.phone.trim();

  return {
    storeName,
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {})
  };
}
