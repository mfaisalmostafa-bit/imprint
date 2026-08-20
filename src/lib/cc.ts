export type JobKind = "quote" | "sample" | "order";
export type ProofStatus = "draft" | "approved" | "rejected";

export type Client = {
  id: string;
  name: string;
  city: string;
};

export type Proof = {
  id: string;
  clientId: string;
  jobKind: JobKind;
  jobRef: string;
  sku: string;
  skuName: string;
  method: string;
  status: ProofStatus;
  settings: string;
  createdAt: number;
  branded: string;
};

const KEY = "tpx-cc-v1";

export const DEMO_CLIENTS: Client[] = [
  { id: "c-nile", name: "Nile Hotels Group", city: "Cairo" },
  { id: "c-delta", name: "Delta Cement", city: "Alexandria" },
  { id: "c-bank", name: "East Bank", city: "New Cairo" },
  { id: "c-port", name: "Port Said Logistics", city: "Port Said" },
  { id: "c-walk", name: "Walk-in / unspecified", city: "—" },
];

type Store = {
  clients: Client[];
  proofs: Proof[];
};

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (Array.isArray(parsed.clients) && Array.isArray(parsed.proofs)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { clients: DEMO_CLIENTS, proofs: [] };
}

function save(s: Store) {
  try {
    const proofs = s.proofs.slice(-40);
    localStorage.setItem(KEY, JSON.stringify({ clients: s.clients, proofs }));
  } catch {
    /* quota */
  }
}

export function listClients(): Client[] {
  return load().clients;
}

export function listProofs(clientId?: string): Proof[] {
  const all = load().proofs;
  return (clientId ? all.filter((p) => p.clientId === clientId) : all).slice().reverse();
}

export function saveProof(p: Omit<Proof, "id" | "createdAt" | "status"> & { status?: ProofStatus }): Proof {
  const store = load();
  const proof: Proof = {
    ...p,
    id: `pf-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    status: p.status ?? "draft",
  };
  store.proofs.push(proof);
  save(store);
  return proof;
}

export function setProofStatus(id: string, status: ProofStatus) {
  const store = load();
  const hit = store.proofs.find((p) => p.id === id);
  if (!hit) return;
  hit.status = status;
  save(store);
}
