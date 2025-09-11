# Test Scenario for IDEAL-STI v3.0

## Test Requirements

<prompt-arguments>
Build a task management system that allows users to create, assign, and track tasks with deadlines and priorities. The system should support team collaboration and send notifications.
</prompt-arguments>

## Expected Flow

1. **Phase 1**: Should invoke use-case-expander and generate UC### numbered use cases
2. **Phase 2**: Should invoke requirements-generator with discovered use cases  
3. **Phase 2.5**: Should assemble unified project-specifications.md
4. **Phase 3**: Should generate implementation tasks
5. **Quality Gates**: Should validate at each transition
6. **State Management**: Should create .ideal-sti/ directory with checkpoints

## Validation Checklist

- [ ] State directory created: `.ideal-sti/`
- [ ] Phase 1 output captured: `.ideal-sti/phase1-output.md`
- [ ] Phase 2 output captured: `.ideal-sti/phase2-output.md`
- [ ] Unified document created: `.ideal-sti/project-specifications.md`
- [ ] Quality gates executed and logged
- [ ] Checkpoints created after each phase
- [ ] Rehydration capability verified

## Test Commands

```bash
# Test fresh execution
/prompt ideal-sti-v3 "Build a task management system..."

# Test rehydration (interrupt and resume)
# 1. Start execution
# 2. Interrupt after Phase 1
# 3. Resume and verify continuation from Phase 2
```

## Success Criteria

1. All phases execute in sequence
2. Prompter subagents are invoked correctly
3. Document assembly produces valid unified output
4. Quality gates enforce validation rules
5. State persists and enables resume capability