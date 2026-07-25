import {
  brandProduct,
  creatorCriteria,
  creatorDeals,
  devOverview,
  negotiationViews,
  roleSessions,
} from "./mockData";
import type {
  BrandProduct,
  CreatorCriteria,
  CreatorDeal,
  DevOverview,
  NegotiationView,
  Role,
  RoleSession,
} from "./types";

export interface KnotDataSource {
  getRoleSession(role: Role): Promise<RoleSession>;
  getBrandProduct(): Promise<BrandProduct>;
  getCreatorCriteria(): Promise<CreatorCriteria>;
  getNegotiation(role: Role): Promise<NegotiationView>;
  getCreatorDeals(): Promise<CreatorDeal[]>;
  getCreatorDeal(brandId: string): Promise<CreatorDeal | null>;
  getDevOverview(): Promise<DevOverview>;
}

class MockKnotDataSource implements KnotDataSource {
  async getRoleSession(role: Role) {
    return roleSessions[role];
  }

  async getBrandProduct() {
    return brandProduct;
  }

  async getCreatorCriteria() {
    return creatorCriteria;
  }

  async getNegotiation(role: Role) {
    return negotiationViews[role];
  }

  async getCreatorDeals() {
    return creatorDeals;
  }

  async getCreatorDeal(brandId: string) {
    return creatorDeals.find((deal) => deal.brandId === brandId) ?? null;
  }

  async getDevOverview() {
    return devOverview;
  }
}

export const knotDataSource: KnotDataSource = new MockKnotDataSource();
