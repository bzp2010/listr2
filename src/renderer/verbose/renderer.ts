import type { ListrVerboseRendererOptions, ListrVerboseRendererTasks } from './renderer.interface'
import { ListrTaskEventType } from '@constants/event.constants'
import { ListrTaskState } from '@constants/state.constants'
import type { ListrRenderer } from '@interfaces/renderer.interface'
import type { Task } from '@lib/task'
import type { RendererPresetTimer, RendererPresetTimestamp } from '@presets'
import { cleanseAnsiOutput } from '@utils'
import type { LoggerRendererOptions } from '@utils/logger'
import { ListrLogger } from '@utils/logger'

export class VerboseRenderer implements ListrRenderer {
  /** designates whether this renderer can output to a non-tty console */
  public static nonTTY = true
  /** renderer options for the verbose renderer */
  public static rendererOptions: {
    /**
     * log title changes
     * @default true
     */
    logTitleChange?: boolean
  } & RendererPresetTimer &
  RendererPresetTimestamp &
  LoggerRendererOptions = {
      logTitleChange: false,
      logger: ListrLogger
    }
  /** per task options for the verbose renderer */
  public static rendererTaskOptions: RendererPresetTimer

  private logger: ListrLogger

  constructor (private readonly tasks: ListrVerboseRendererTasks, private readonly options: ListrVerboseRendererOptions) {
    this.options = {
      ...VerboseRenderer.rendererOptions,
      loggerOptions: {
        useIcons: false,
        fieldOptions: {
          prefix: [ this.options.timestamp ]
        }
      },
      ...this.options
    }

    this.logger = new this.options.logger(this.options.loggerOptions)
  }

  public render (): void {
    this.renderer(this.tasks)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public end (): void {}

  public getSelfOrParentOption<K extends keyof ListrVerboseRendererOptions>(task: Task<any, typeof VerboseRenderer>, key: K): ListrVerboseRendererOptions[K] {
    return task?.rendererOptions?.[key] ?? this.options?.[key]
  }

  // verbose renderer multi-level
  private renderer (tasks: ListrVerboseRendererTasks): void {
    return tasks?.forEach((task) => {
      task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
        this.renderer(subtasks)
      })

      task.on(ListrTaskEventType.STATE, (state) => {
        if (!task.hasTitle()) {
          return
        }

        if (state === ListrTaskState.STARTED) {
          this.logger.started(task.title)
        } else if (state === ListrTaskState.COMPLETED) {
          const timer = this.getSelfOrParentOption(task, 'timer')

          this.logger.completed(
            task.title,
            timer && {
              suffix: {
                ...timer,
                condition: !!task.message?.duration && timer.condition,
                args: [ task.message.duration ]
              }
            }
          )
        }
      })

      task.on(ListrTaskEventType.OUTPUT, (data) => {
        this.logger.output(data)
      })

      task.on(ListrTaskEventType.PROMPT, (prompt) => {
        const cleansed = cleanseAnsiOutput(prompt).trim()

        if (cleansed) {
          this.logger.prompt(cleansed)
        }
      })

      if (this.options?.logTitleChange !== false) {
        task.on(ListrTaskEventType.TITLE, (title) => {
          this.logger.title(title)
        })
      }

      task.on(ListrTaskEventType.MESSAGE, (message) => {
        if (message?.error) {
          // error message
          this.logger.failed(message.error)
        } else if (message?.skip) {
          // skip message
          this.logger.skipped(message.skip)
        } else if (message?.rollback) {
          // rollback message
          this.logger.rollback(message.rollback)
        } else if (message?.retry) {
          this.logger.retry(task.title, { suffix: message.retry.count.toString() })
        }
      })
    })
  }
}
