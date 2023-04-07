import type { ListrVerboseRendererOptions, ListrVerboseRendererTask, ListrVerboseRendererTaskOptions } from './renderer.interface'
import { ListrTaskEventType, ListrTaskState } from '@constants'
import type { ListrRenderer } from '@interfaces'
import { parseTimer } from '@presets'
import { ListrLogger, ListrLogLevels, cleanseAnsi, LISTR_LOGGER_STYLE, LISTR_LOGGER_STDERR_LEVELS } from '@utils'

export class VerboseRenderer implements ListrRenderer {
  public static nonTTY = true
  public static rendererOptions: ListrVerboseRendererOptions = {
    logTitleChange: false
  }
  public static rendererTaskOptions: ListrVerboseRendererTaskOptions

  private logger: ListrLogger

  constructor (private readonly tasks: ListrVerboseRendererTask[], private readonly options: ListrVerboseRendererOptions) {
    this.options = {
      ...VerboseRenderer.rendererOptions,
      ...this.options,
      icon: {
        ...LISTR_LOGGER_STYLE.icon,
        ...options?.icon ?? {}
      },
      color: {
        ...LISTR_LOGGER_STYLE.color,
        ...options?.color ?? {}
      }
    }

    this.logger = this.options.logger ?? new ListrLogger<ListrLogLevels>({ useIcons: false, toStderr: LISTR_LOGGER_STDERR_LEVELS })

    this.logger.options.icon = this.options.icon
    this.logger.options.color = this.options.color

    if (this.options.timestamp) {
      this.logger.options.fields.prefix.unshift(this.options.timestamp)
    }
  }

  public render (): void {
    this.renderer(this.tasks)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public end (): void {}

  public getSelfOrParentOption<K extends keyof ListrVerboseRendererOptions>(task: ListrVerboseRendererTask, key: K): ListrVerboseRendererOptions[K] {
    return task?.rendererOptions?.[key] ?? this.options?.[key]
  }

  // verbose renderer multi-level
  private renderer (tasks: ListrVerboseRendererTask[]): void {
    return tasks?.forEach((task) => {
      task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
        this.renderer(subtasks)
      })

      task.on(ListrTaskEventType.STATE, (state) => {
        if (!task.hasTitle()) {
          return
        }

        if (state === ListrTaskState.STARTED) {
          this.logger.log(ListrLogLevels.STARTED, task.title)
        } else if (state === ListrTaskState.COMPLETED) {
          const timer = this.getSelfOrParentOption(task, 'timer')

          this.logger.log(
            ListrLogLevels.COMPLETED,
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
        this.logger.log(ListrLogLevels.OUTPUT, data)
      })

      task.on(ListrTaskEventType.PROMPT, (prompt) => {
        const cleansed = cleanseAnsi(prompt)

        if (cleansed) {
          this.logger.log(ListrLogLevels.PROMPT, cleansed)
        }
      })

      if (this.options?.logTitleChange !== false) {
        task.on(ListrTaskEventType.TITLE, (title) => {
          this.logger.log(ListrLogLevels.TITLE, title)
        })
      }

      task.on(ListrTaskEventType.MESSAGE, (message) => {
        if (message?.error) {
          // error message
          this.logger.log(ListrLogLevels.FAILED, message.error)
        } else if (message?.skip) {
          // skip message
          this.logger.log(ListrLogLevels.SKIPPED, message.skip)
        } else if (message?.rollback) {
          // rollback message
          this.logger.log(ListrLogLevels.ROLLBACK, message.rollback)
        } else if (message?.retry) {
          this.logger.log(ListrLogLevels.RETRY, task.title, { suffix: message.retry.count.toString() })
        } else if (message?.paused) {
          this.logger.log(ListrLogLevels.PAUSED, task.title, { suffix: parseTimer(message.paused - Date.now()) })
        }
      })
    })
  }
}