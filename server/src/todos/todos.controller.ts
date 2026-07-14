import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Task, TodoGroup } from '../planner/planner-state.entity';
import { TodosService } from './todos.service';
import { RequirePermission } from '../auth/auth.decorators';

@Controller('todos')
@RequirePermission('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(): Promise<TodoGroup[]> {
    return this.todosService.findAll();
  }

  @Post('groups')
  @RequirePermission('todos', 'edit')
  createGroup(@Body() body: { title: string }): Promise<TodoGroup[]> {
    return this.todosService.createGroup(body);
  }

  @Patch('groups/:id')
  @RequirePermission('todos', 'edit')
  updateGroup(@Param('id') id: string, @Body() body: Partial<TodoGroup>): Promise<TodoGroup[]> {
    return this.todosService.updateGroup(id, body);
  }

  @Delete('groups/:id')
  @RequirePermission('todos', 'edit')
  deleteGroup(@Param('id') id: string): Promise<TodoGroup[]> {
    return this.todosService.deleteGroup(id);
  }

  @Post('groups/:groupId/tasks')
  @RequirePermission('todos', 'edit')
  createTask(@Param('groupId') groupId: string, @Body() body: Omit<Task, 'id'>): Promise<TodoGroup[]> {
    return this.todosService.createTask(groupId, body);
  }

  @Patch('tasks/:id')
  @RequirePermission('todos', 'edit')
  updateTask(@Param('id') id: string, @Body() body: Partial<Task>): Promise<TodoGroup[]> {
    return this.todosService.updateTask(id, body);
  }

  @Delete('tasks/:id')
  @RequirePermission('todos', 'edit')
  deleteTask(@Param('id') id: string): Promise<TodoGroup[]> {
    return this.todosService.deleteTask(id);
  }
}
