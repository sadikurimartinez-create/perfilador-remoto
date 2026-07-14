import Dexie, { Table } from "dexie";

export type ProjectRow = {
  id: string;
  name: string;
  createdAt: number;
  createdBy?: string;
  lockedBy?: string | null;
};

export type PhotoRow = {
  id: string;
  projectId: string;
  imageBlob: Blob;
  tag: string;
  comments: string;
  lat: number;
  lng: number;
  timestamp: number;
};

export type AnalysisRow = {
  id?: number;
  projectId: string;
  content: string;
  createdAt: number;
  createdBy?: string;
};

export type UserRow = {
  id?: number;
  username: string;
  passwordHash: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  name: string;
};

export type OsintEventRow = {
  id: string;
  projectId: string;
  source: string;
  platform: string;
  content: string;
  timestamp: string;
  location: { type: "Point"; coordinates: [number, number] } | null;
  entities: string[];
  keywords: string[];
  risk_score: number;
  risk_level: string;
  neighborhood?: string;
  url?: string;
  traceabilityHash: string;
};

export type OsintSnapshotRow = {
  projectId: string;
  events: OsintEventRow[];
  frozenAt: number;
};

class LocalPerfiladorDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  photos!: Table<PhotoRow, string>;
  analyses!: Table<AnalysisRow, number>;
  users!: Table<UserRow, number>;
  osint_events!: Table<OsintEventRow, string>;
  osint_snapshots!: Table<OsintSnapshotRow, string>;

  constructor() {
    super("PerfiladorRemotoDB");
    this.version(1).stores({
      projects: "id, name, createdAt",
      photos: "id, projectId, timestamp",
    });
    this.version(2).stores({
      projects: "id, name, createdAt",
      photos: "id, projectId, timestamp",
      analyses: "++id, projectId, createdAt",
    });
    this.version(3).stores({
      projects: "id, name, createdAt, createdBy, lockedBy",
      photos: "id, projectId, timestamp",
      analyses: "++id, projectId, createdAt, createdBy",
      users: "++id, username, role",
    });
    this.version(4).stores({
      projects: "id, name, createdAt, createdBy, lockedBy",
      photos: "id, projectId, timestamp",
      analyses: "++id, projectId, createdAt, createdBy",
      users: "++id, username, role",
      osint_events: "id, projectId, platform, risk_level, timestamp",
      osint_snapshots: "projectId, frozenAt",
    });
  }
}

export const db = new LocalPerfiladorDB();

