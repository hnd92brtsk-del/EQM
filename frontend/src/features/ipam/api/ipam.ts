import { apiFetch } from "../../../api/client";
import type { Pagination } from "../../../api/entities";
import { buildQuery } from "../../../api/entities";
import { downloadFile } from "../../../api/importExport";
import type {
  AddressGridResponse,
  CabinetItemIPAMSummary,
  EligibleEquipment,
  IPAddressDetails,
  Subnet,
  Vlan
} from "../types";

export function listVlans(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<Pagination<Vlan>>(`/ipam/vlans${buildQuery(params)}`);
}

export function createVlan(payload: {
  vlan_number: number;
  name: string;
  purpose?: string | null;
  description?: string | null;
  location_id?: number | null;
  is_active?: boolean;
}) {
  return apiFetch<Vlan>("/ipam/vlans", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateVlan(
  vlanId: number,
  payload: {
    vlan_number?: number;
    name?: string;
    purpose?: string | null;
    description?: string | null;
    location_id?: number | null;
    is_active?: boolean;
  }
) {
  return apiFetch<Vlan>(`/ipam/vlans/${vlanId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteVlan(vlanId: number) {
  return apiFetch<void>(`/ipam/vlans/${vlanId}`, { method: "DELETE" });
}

export function listSubnets(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<Pagination<Subnet>>(`/ipam/subnets${buildQuery(params)}`);
}

export function createSubnet(payload: {
  vlan_id?: number | null;
  cidr: string;
  gateway_ip?: string | null;
  name?: string | null;
  description?: string | null;
  location_id?: number | null;
  vrf?: string | null;
  is_active?: boolean;
}) {
  return apiFetch<Subnet>("/ipam/subnets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSubnet(
  subnetId: number,
  payload: {
    vlan_id?: number | null;
    gateway_ip?: string | null;
    name?: string | null;
    description?: string | null;
    location_id?: number | null;
    vrf?: string | null;
    is_active?: boolean;
  }
) {
  return apiFetch<Subnet>(`/ipam/subnets/${subnetId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteSubnet(subnetId: number) {
  return apiFetch<void>(`/ipam/subnets/${subnetId}`, { method: "DELETE" });
}

export function getSubnetAddresses(
  subnetId: number,
  params: Record<string, string | number | boolean | undefined>
) {
  return apiFetch<AddressGridResponse>(`/ipam/subnets/${subnetId}/addresses${buildQuery(params)}`);
}

export function getAddressDetails(subnetId: number, offset: number) {
  return apiFetch<IPAddressDetails>(`/ipam/subnets/${subnetId}/addresses/${offset}`);
}

export function patchAddress(
  subnetId: number,
  offset: number,
  payload: {
    status?: string;
    hostname?: string | null;
    dns_name?: string | null;
    comment?: string | null;
    equipment_instance_id?: number | null;
    equipment_interface_id?: number | null;
    is_primary?: boolean;
    mac_address?: string | null;
  }
) {
  return apiFetch<IPAddressDetails>(`/ipam/subnets/${subnetId}/addresses/${offset}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function assignAddress(
  subnetId: number,
  offset: number,
  payload: {
    hostname?: string;
    dns_name?: string;
    comment?: string;
    equipment_instance_id: number;
    equipment_interface_id: number;
    is_primary?: boolean;
    mac_address?: string;
  }
) {
  return apiFetch<IPAddressDetails>(`/ipam/subnets/${subnetId}/addresses/${offset}/assign`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function reserveAddress(
  subnetId: number,
  offset: number,
  payload: { hostname?: string; comment?: string }
) {
  return apiFetch<IPAddressDetails>(`/ipam/subnets/${subnetId}/addresses/${offset}/reserve`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function releaseAddress(subnetId: number, offset: number) {
  return apiFetch<IPAddressDetails>(`/ipam/subnets/${subnetId}/addresses/${offset}/release`, {
    method: "POST"
  });
}

export function listEligibleEquipment(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<EligibleEquipment[]>(`/ipam/equipment/eligible${buildQuery(params)}`);
}

export function getCabinetItemIPAMSummary(itemId: number) {
  return apiFetch<CabinetItemIPAMSummary>(`/cabinet-items/${itemId}/ipam-summary`);
}

export function exportSubnetCsv(subnetId: number) {
  return downloadFile(`/ipam/subnets/${subnetId}/export.csv`, {}, `subnet-${subnetId}.csv`);
}
