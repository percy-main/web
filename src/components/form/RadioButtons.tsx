import type { ChangeEvent, FC } from "react";

type Props<T> = Omit<
  React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >,
  "value" | "onChange" | "defaultValue"
> & {
  id: string;
  options: Array<{
    title: string;
    value: T;
    description?: string;
  }>;
  value: T | undefined;
  onChange: (e: T) => void;
};

export const RadioButtons = <T,>({
  options,
  id,
  value,
  ...inputProps
}: Props<T>) => (
  <div className="relative z-0 w-full mt-2 mb-5 group">
    {options.map(({ title, value: radioValue, description }) => {
      return (
        <label
          htmlFor={`${id}-${radioValue}`}
          key={`${id}-${radioValue}`}
          className="flex items-center mb-4"
        >
          <input
            {...inputProps}
            type="radio"
            id={`${id}-${radioValue}`}
            name={`${id}-${radioValue}`}
            checked={radioValue === value}
            onChange={() => inputProps.onChange(radioValue)}
          />
          <div className="ms-2 font-medium text-gray-900 dark:text-gray-300">
            {title}
            {description && (
              <p
                id="helper-radio-text"
                className="text-xs font-normal text-gray-500 dark:text-gray-300"
              >
                {description}
              </p>
            )}
          </div>
        </label>
      );
    })}
  </div>
);
