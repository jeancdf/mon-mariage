import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlannerState, PlannerStateEntity } from './planner-state.entity';

const DEFAULT_PLANNER_ID = 'default';

@Injectable()
export class PlannerService {
  constructor(
    @InjectRepository(PlannerStateEntity)
    private readonly plannerRepository: Repository<PlannerStateEntity>,
  ) {}

  async find(): Promise<PlannerState | null> {
    const row = await this.plannerRepository.findOne({
      where: { id: DEFAULT_PLANNER_ID },
    });

    return row?.state ?? null;
  }

  async save(state: PlannerState): Promise<PlannerState> {
    const normalizedState = this.normalizeState(state);

    await this.plannerRepository.upsert(
      { id: DEFAULT_PLANNER_ID, state: normalizedState },
      ['id'],
    );

    return normalizedState;
  }

  private normalizeState(state: PlannerState): PlannerState {
    return {
      guests: Array.isArray(state.guests) ? state.guests : [],
      houses: Array.isArray(state.houses) ? state.houses : [],
      tables: Array.isArray(state.tables) ? state.tables : [],
      budget: state.budget?.categories ? state.budget : { categories: [] },
      todos: Array.isArray(state.todos) ? state.todos : [],
      theme: state.theme ?? 'blanc',
    };
  }
}
