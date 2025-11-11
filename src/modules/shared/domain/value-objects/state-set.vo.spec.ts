import { StateSet } from './state-set.vo';
import { StateAbbreviation } from '../enums/state.enum';

describe('StateSet Value Object', () => {
  describe('fromStrings', () => {
    it('should create StateSet from valid state strings', () => {
      const stateSet = StateSet.fromStrings(['NJ', 'MI']);

      expect(stateSet.toArray()).toContain(StateAbbreviation.NJ);
      expect(stateSet.toArray()).toContain(StateAbbreviation.MI);
      expect(stateSet.count()).toBe(2);
    });

    it('should throw error for invalid state', () => {
      expect(() => {
        StateSet.fromStrings(['NJ', 'INVALID']);
      }).toThrow('Invalid state abbreviation');
    });

    it('should throw error for empty array', () => {
      expect(() => {
        StateSet.fromStrings([]);
      }).toThrow('StateSet must contain at least one state');
    });
  });

  describe('all', () => {
    it('should create StateSet with all four states', () => {
      const stateSet = StateSet.all();

      expect(stateSet.count()).toBe(4);
      expect(stateSet.isAllStates()).toBe(true);
    });
  });

  describe('single', () => {
    it('should create StateSet with single state', () => {
      const stateSet = StateSet.single(StateAbbreviation.NJ);

      expect(stateSet.count()).toBe(1);
      expect(stateSet.has(StateAbbreviation.NJ)).toBe(true);
    });
  });

  describe('has', () => {
    it('should check if state exists in set', () => {
      const stateSet = StateSet.fromStrings(['NJ', 'MI']);

      expect(stateSet.has(StateAbbreviation.NJ)).toBe(true);
      expect(stateSet.has(StateAbbreviation.PA)).toBe(false);
    });
  });

  describe('add', () => {
    it('should add state to set', () => {
      const stateSet = StateSet.single(StateAbbreviation.NJ);
      const newStateSet = stateSet.add(StateAbbreviation.MI);

      expect(newStateSet.count()).toBe(2);
      expect(newStateSet.has(StateAbbreviation.MI)).toBe(true);
      // Original should be unchanged
      expect(stateSet.count()).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove state from set', () => {
      const stateSet = StateSet.fromStrings(['NJ', 'MI']);
      const newStateSet = stateSet.remove(StateAbbreviation.MI);

      expect(newStateSet.count()).toBe(1);
      expect(newStateSet.has(StateAbbreviation.MI)).toBe(false);
    });

    it('should throw error when removing last state', () => {
      const stateSet = StateSet.single(StateAbbreviation.NJ);

      expect(() => {
        stateSet.remove(StateAbbreviation.NJ);
      }).toThrow('Cannot remove last state from StateSet');
    });
  });

  describe('equals', () => {
    it('should return true for equal state sets', () => {
      const stateSet1 = StateSet.fromStrings(['NJ', 'MI']);
      const stateSet2 = StateSet.fromStrings(['MI', 'NJ']);

      expect(stateSet1.equals(stateSet2)).toBe(true);
    });

    it('should return false for different state sets', () => {
      const stateSet1 = StateSet.fromStrings(['NJ', 'MI']);
      const stateSet2 = StateSet.fromStrings(['NJ', 'PA']);

      expect(stateSet1.equals(stateSet2)).toBe(false);
    });
  });
});
