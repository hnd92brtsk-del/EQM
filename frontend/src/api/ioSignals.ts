import { apiFetch, getApiUrl, getToken } from "./client";

export type IOTreeChannelDevice = {
  equipment_in_operation_id: number;
  equipment_name: string;
  manufacturer_name?: string | null;
  nomenclature_number?: string | null;
  article?: string | null;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  signals_total: number;
};

export type IOTreeCabinet = {
  id: number;
  name: string;
  factory_number?: string | null;
  inventory_number?: string | null;
  channel_devices: IOTreeChannelDevice[];
};

export type IOTreeLocation = {
  id: number;
  name: string;
  children?: IOTreeLocation[];
  cabinets?: IOTreeCabinet[];
};

export type IOTreeResponse = {
  locations: IOTreeLocation[];
};

export type IOSignal = {
  id: number;
  equipment_in_operation_id: number;
  signal_type: string;
  channel_index: number;
  tag?: string | null;
  signal?: string | null;
  signal_kind_id?: number | null;
  measurement_type?: string | null;
  measurement_unit_id?: number | null;
  measurement_unit_full_path?: string | null;
  is_active: boolean;
  is_deleted: boolean;
};

export type IOSignalUpdate = Partial<
  Pick<IOSignal, "tag" | "signal" | "signal_kind_id" | "measurement_type" | "measurement_unit_id" | "is_active">
>;

function logRequest(label: string, path: string) {
  const baseUrl = getApiUrl("");
  const token = getToken();
  const tokenPreview = token ? `${token.slice(0, 10)}...` : "missing";
  const tokenLength = token ? token.length : 0;
  console.info(`[IO Signals] ${label} baseUrl`, baseUrl);
  console.info(`[IO Signals] ${label} requestUrl`, getApiUrl(path));
  console.info(
    `[IO Signals] ${label} Authorization`,
    token ? `Bearer ${tokenPreview} (len=${tokenLength})` : "missing"
  );
}

function logError(label: string, err: unknown) {
  console.error(`[IO Signals] ${label} fetch error`, err);
  if (err instanceof Error) {
    console.error(`[IO Signals] ${label} error name/message`, err.name, err.message);
  }
}

export async function getIOTree(): Promise<IOTreeResponse> {
  const path = "/io-tree";
  logRequest("getIOTree", path);
  try {
    return await apiFetch<IOTreeResponse>(path);
  } catch (err) {
    logError("getIOTree", err);
    throw err;
  }
}

export async function listIOSignals(equipmentInOperationId: number): Promise<IOSignal[]> {
  const path = `/io-signals/?equipment_in_operation_id=${equipmentInOperationId}`;
  logRequest("listIOSignals", path);
  try {
    return await apiFetch<IOSignal[]>(path);
  } catch (err) {
    logError("listIOSignals", err);
    throw err;
  }
}

export async function updateIOSignal(id: number, payload: IOSignalUpdate): Promise<IOSignal> {
  const path = `/io-signals/${id}`;
  logRequest("updateIOSignal", path);
  try {
    return await apiFetch<IOSignal>(path, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  } catch (err) {
    logError("updateIOSignal", err);
    throw err;
  }
}

export async function rebuildIOSignals(
  equipmentInOperationId: number,
  prune = false
): Promise<{ status: string; created?: number; restored?: number; pruned?: number }> {
  const query = `equipment_in_operation_id=${equipmentInOperationId}&prune=${prune ? "true" : "false"}`;
  const path = `/io-signals/rebuild?${query}`;
  logRequest("rebuildIOSignals", path);
  try {
    return await apiFetch<{ status: string; created?: number; restored?: number; pruned?: number }>(
      path,
      { method: "POST" }
    );
  } catch (err) {
    logError("rebuildIOSignals", err);
    throw err;
  }
}
