import { describe, it, expect } from 'vitest';
import {
  can,
  canReadBoard,
  canWriteBoard,
  canCreateBoard,
  canCreateChild,
  canDeleteBoard,
  scopesToAssignedEngagements,
} from './roles';

describe('desk permissions', () => {
  it('accountant cannot read or write the commercial boards', () => {
    expect(canReadBoard('accountant', 'pnl')).toBe(false);
    expect(canWriteBoard('accountant', 'pnl')).toBe(false);
    expect(can('accountant', 'pnl.read')).toBe(false);
    // The QoE pipeline is commercial too — accountants never see it.
    expect(canReadBoard('accountant', 'deals')).toBe(false);
    expect(canWriteBoard('accountant', 'deals')).toBe(false);
  });
  it('accountant has the Commercial dashboard hidden', () => {
    expect(can('accountant', 'commercial.view')).toBe(false);
  });
  it('accountant reads the managed-accounting boards (rows are scoped separately)', () => {
    expect(canReadBoard('accountant', 'engagements')).toBe(true);
    expect(canReadBoard('accountant', 'clients')).toBe(true);
    expect(canReadBoard('accountant', 'cycles')).toBe(true);
  });
  it('accountant is the only scoped role', () => {
    expect(scopesToAssignedEngagements('accountant')).toBe(true);
    expect(scopesToAssignedEngagements('controller')).toBe(false);
    expect(scopesToAssignedEngagements('management')).toBe(false);
    expect(scopesToAssignedEngagements('owner')).toBe(false);
  });
  it('accountant never creates top-level rows, only children under a visible parent', () => {
    expect(canCreateBoard('accountant', 'engagements')).toBe(false);
    expect(canCreateBoard('accountant', 'clients')).toBe(false);
    expect(canCreateBoard('accountant', 'cycles')).toBe(false);
    expect(canCreateChild('accountant', 'cycles')).toBe(true);
    expect(canCreateChild('accountant', 'queries')).toBe(true);
    expect(canCreateChild('accountant', 'deliverables')).toBe(true);
  });
  it('accountant may delete their operational children but not setup records', () => {
    expect(canDeleteBoard('accountant', 'queries')).toBe(true);
    expect(canDeleteBoard('accountant', 'cycles')).toBe(true);
    expect(canDeleteBoard('accountant', 'engagements')).toBe(false);
    expect(canDeleteBoard('accountant', 'clients')).toBe(false);
  });
  it('controller sees every operational board but not the commercials', () => {
    expect(canReadBoard('controller', 'engagements')).toBe(true);
    expect(canReadBoard('controller', 'deals')).toBe(true);
    expect(canCreateBoard('controller', 'engagements')).toBe(true);
    expect(scopesToAssignedEngagements('controller')).toBe(false);
    // Commercials are management-only now.
    expect(can('controller', 'pnl.read')).toBe(false);
    expect(canReadBoard('controller', 'pnl')).toBe(false);
    expect(can('controller', 'commercial.view')).toBe(false);
    expect(canWriteBoard('controller', 'pnl')).toBe(false);
  });
  it('only management (and owner) see the commercials', () => {
    expect(can('management', 'pnl.read')).toBe(true);
    expect(can('management', 'commercial.view')).toBe(true);
    expect(canWriteBoard('management', 'pnl')).toBe(true);
    expect(can('owner', 'pnl.read')).toBe(true);
    expect(can('owner', 'commercial.view')).toBe(true);
  });
  it('only the owner manages the team and views the audit log', () => {
    expect(can('owner', 'team.manage')).toBe(true);
    expect(can('management', 'team.manage')).toBe(false);
    expect(can('controller', 'audit.view')).toBe(false);
    expect(can('owner', 'audit.view')).toBe(true);
  });
});
