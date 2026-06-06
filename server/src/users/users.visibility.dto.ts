import { IsIn, IsString } from 'class-validator';

export class SetVisibilityDto {
  @IsString()
  @IsIn(['online', 'invisible'])
  status!: 'online' | 'invisible';
}
