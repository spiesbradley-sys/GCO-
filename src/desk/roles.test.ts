import { describe, it, expect } from 'vitest';
import { can, canReadBoard, canWriteBoard } from './roles';

describe('desk permissions', () => {
  it('accountant cannot read or write P&L', () => {
    expect(canReadBoard('accountant', 'pnl')).toBe(false);
    expect(canWriteBoard('accountant', 'pnl')).toBe(false);
    expect(can('accountant', 'pnl.read')).toBe(false);
  });
  it('accountant has the Commercial dashboard hidden', () => {
    expect(can('accountant', 'commercial.view')).toBe(false);
  });
  it('accountant can work the core boards', () => {
    expect(canWriteBoard('accountant', 'clients')).toBe(true);
    expect(canWriteBoard('accountant', 'deals')).toBe(true);
  });
  it('controller reads P&L but cannot write it', () => {
    expect(can('controller', 'pnl.read')).toBe(true);
    expect(canWriteBoard('controller', 'pnl')).toBe(false);
  });
  it('only the owner manages the team and views the audit log', () => {
    expect(can('owner', 'team.manage')).toBe(true);
    expect(can('management', 'team.manage')).toBe(false);
    expect(can('controller', 'audit.view')).toBe(false);
    expect(can('owner', 'audit.view')).toBe(true);
  });
  it('management can write P&L', () => {
    expect(canWriteBoard('management', 'pnl')).toBe(true);
  });
});
