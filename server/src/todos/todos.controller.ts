import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Task, TodoGroup } from '../planner/planner-state.entity';
import { TodosService } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(): Promise<TodoGroup[]> {
    return this.todosService.findAll();
  }

  @Post('groups')
  createGroup(@Body() body: { title: string }): Promise<TodoGroup[]> {
    return this.todosService.createGroup(body);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() body: Partial<TodoGroup>): Promise<TodoGroup[]> {
    return this.todosService.updateGroup(id, body);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string): Promise<TodoGroup[]> {
    return this.todosService.deleteGroup(id);
  }

  @Post('groups/:groupId/tasks')
  createTask(@Param('groupId') groupId: string, @Body() body: Omit<Task, 'id'>): Promise<TodoGroup[]> {
    return this.todosService.createTask(groupId, body);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: Partial<Task>): Promise<TodoGroup[]> {
    return this.todosService.updateTask(id, body);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string): Promise<TodoGroup[]> {
    return this.todosService.deleteTask(id);
  }
}
