import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { FeatureFlagsService, FlagName } from './feature-flags.service';

@Controller('flags')
export class FeatureFlagsController {
    constructor(private readonly flags: FeatureFlagsService) { }

    @Get()
    getAll() {
        return this.flags.getAll();
    }

    @Post(':name')
    toggle(@Param('name') name: string) {
        const result = this.flags.toggle(name as FlagName);
        if (!result) throw new NotFoundException(`Flag '${name}' not found`);
        return result;
    }
}
