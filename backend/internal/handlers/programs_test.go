package handlers

import "testing"

func TestValidateProgramRequest(t *testing.T) {
	tests := []struct {
		name    string
		request programRequest
		valid   bool
	}{
		{
			name: "program with named days and exercises",
			request: programRequest{
				Name: "Rutina PowerBuilding",
				Days: []programDayRequest{
					{Name: "Día 1: Empuje", Exercises: []string{"Press de Banca"}},
					{Name: "Día 2: Tirón"},
				},
			},
			valid: true,
		},
		{
			name:    "missing program name",
			request: programRequest{Days: []programDayRequest{{Name: "Día 1"}}},
		},
		{
			name:    "missing days",
			request: programRequest{Name: "Rutina"},
		},
		{
			name:    "missing day name",
			request: programRequest{Name: "Rutina", Days: []programDayRequest{{Exercises: []string{"Press"}}}},
		},
		{
			name: "blank exercise name",
			request: programRequest{
				Name: "Rutina",
				Days: []programDayRequest{{Name: "Día 1", Exercises: []string{" "}}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotError := validateProgramRequest(test.request) != ""
			if gotError == test.valid {
				t.Fatalf("validateProgramRequest() error = %v, want valid=%v", gotError, test.valid)
			}
		})
	}
}
